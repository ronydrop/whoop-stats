// Package poller implements periodic data fetching from the WHOOP API.
// It runs independent polling loops for cycles, workouts, sleeps, and user
// profile data, with configurable intervals and built-in rate limiting.
package poller

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"math/big"
	"sync"
	"time"

	"github.com/arvind/whoop-stats/internal/auth"
	"github.com/arvind/whoop-stats/internal/config"
	"github.com/arvind/whoop-stats/internal/storage"
	"github.com/arvind/whoop-stats/internal/whoopdata"
	"golang.org/x/time/rate"
)

// Poller periodically fetches WHOOP data and upserts it into the database.
// It manages separate polling loops for different data types and enforces
// API rate limits across all concurrent requests.
type Poller struct {
	cfg         *config.Config
	authManager *auth.Manager
	storage     *storage.Storage
	logger      *slog.Logger
	whoopUserID string

	// limiter enforces WHOOP API rate limits across all polling goroutines.
	limiter *rate.Limiter

	lastOffpeakSleepPoll time.Time
	runMu                sync.Mutex
}

// NewPoller creates a new Poller. The rate limiter allows 2 requests per second
// to stay well under the WHOOP API rate limit.
func NewPoller(cfg *config.Config, authManager *auth.Manager, store *storage.Storage, logger *slog.Logger, whoopUserID string) *Poller {
	return &Poller{
		cfg:         cfg,
		authManager: authManager,
		storage:     store,
		logger:      logger,
		whoopUserID: whoopUserID,
		limiter:     rate.NewLimiter(rate.Every(500*time.Millisecond), 2),
	}
}

// Start begins all polling loops and blocks until the context is cancelled.
func (p *Poller) Start(ctx context.Context) {
	p.logger.Info("Starting polling engine", "user_id", p.whoopUserID)

	type loopConfig struct {
		name     string
		envKey   string
		pollFunc func(context.Context) error
	}

	loops := []loopConfig{
		{"cycles_recoveries", p.cfg.PollIntervalCycle, p.pollCyclesAndRecoveries},
		{"workouts", p.cfg.PollIntervalWorkout, p.pollWorkouts},
		{"sleeps", p.cfg.PollIntervalSleep, p.pollSleeps},
		{"profile", p.cfg.PollIntervalProfile, p.pollUserProfile},
	}

	var wg sync.WaitGroup
	for _, lc := range loops {
		interval, err := time.ParseDuration(lc.envKey)
		if err != nil {
			p.logger.Error("Invalid poll interval, using 1h default", "task", lc.name, "value", lc.envKey, "error", err)
			interval = 1 * time.Hour
		}

		wg.Add(1)
		go func(name string, interval time.Duration, fn func(context.Context) error) {
			defer wg.Done()
			p.pollLoop(ctx, name, interval, fn)
		}(lc.name, interval, lc.pollFunc)
	}

	wg.Wait()
}

// waitForRateLimit blocks until the rate limiter allows a request, logging
// if the wait exceeds 600ms (indicating throttling pressure).
func (p *Poller) waitForRateLimit(ctx context.Context, task string) error {
	start := time.Now()
	if err := p.limiter.Wait(ctx); err != nil {
		return err
	}
	if d := time.Since(start); d > 600*time.Millisecond {
		p.logger.Debug("Rate limiter throttled request", "task", task, "wait", d)
	}
	return nil
}

// pollLoop runs a polling function on a fixed interval with initial jitter
// to prevent thundering herd on startup.
func (p *Poller) pollLoop(ctx context.Context, name string, interval time.Duration, pollFunc func(ctx context.Context) error) {
	// Initial jitter (0-60s) to stagger startup across loops
	var jitter time.Duration
	n, err := rand.Int(rand.Reader, big.NewInt(60))
	if err != nil {
		p.logger.Error("Failed to generate secure jitter, using 0", "task", name, "error", err)
		jitter = 0
	} else {
		jitter = time.Duration(n.Int64()) * time.Second
	}

	select {
	case <-time.After(jitter):
	case <-ctx.Done():
		return
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		start := time.Now()
		p.logger.Info("Starting poll run", "task", name)

		if err := p.runScheduled(ctx, name, pollFunc); err != nil {
			p.logger.Error("Poll run failed", "task", name, "error", err, "duration", time.Since(start))
		} else {
			p.logger.Info("Poll run succeeded", "task", name, "duration", time.Since(start))
		}

		select {
		case <-ctx.Done():
			p.logger.Info("Stopping poll loop", "task", name)
			return
		case <-ticker.C:
		}
	}
}

// RunAdHocSync performs a one-off sync of all data types. Used by the /sync endpoint.
func (p *Poller) StartAdHocSync(ctx context.Context) bool {
	if !p.runMu.TryLock() {
		return false
	}
	go func() {
		defer p.runMu.Unlock()
		ctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		defer cancel()
		for _, step := range []struct {
			name string
			fn   func(context.Context) error
		}{
			{"cycles_recoveries", p.pollCyclesAndRecoveries}, {"workouts", p.pollWorkouts}, {"sleeps", p.pollSleeps}, {"profile", p.pollUserProfile},
		} {
			if err := p.runTracked(ctx, step.name, step.fn); err != nil {
				p.logger.Error("Falha na sincronização", "resource", step.name, "error", err)
			}
		}
	}()
	return true
}
func (p *Poller) Busy() bool {
	if !p.runMu.TryLock() {
		return true
	}
	p.runMu.Unlock()
	return false
}
func (p *Poller) runScheduled(ctx context.Context, name string, fn func(context.Context) error) error {
	p.runMu.Lock()
	defer p.runMu.Unlock()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if name == "sleeps" {
		location, _ := time.LoadLocation("America/Sao_Paulo")
		hour := time.Now().In(location).Hour()
		if hour < 6 || hour > 12 {
			interval, err := time.ParseDuration(p.cfg.PollIntervalSleepOffpeak)
			if err != nil {
				interval = 4 * time.Hour
			}
			if time.Since(p.lastOffpeakSleepPoll) < interval {
				return nil
			}
		}
	}
	err := p.runTracked(ctx, name, fn)
	if err == nil && name == "sleeps" {
		p.lastOffpeakSleepPoll = time.Now()
	}
	return err
}
func (p *Poller) runTracked(ctx context.Context, name string, fn func(context.Context) error) error {
	started := time.Now()
	if err := p.storage.SetSyncStatus(ctx, p.whoopUserID, name, "running", started, nil); err != nil {
		return err
	}
	runErr := fn(ctx)
	state := "success"
	if runErr != nil {
		state = "error"
	}
	finishCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	return errors.Join(runErr, p.storage.SetSyncStatus(finishCtx, p.whoopUserID, name, state, started, runErr))
}

func (p *Poller) pollCyclesAndRecoveries(ctx context.Context) error {
	client, err := p.authManager.GetClient(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting client: %w", err)
	}
	internalUserID, err := p.authManager.GetInternalUserID(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting internal user ID: %w", err)
	}

	// --- Cycles ---
	if err := p.waitForRateLimit(ctx, "cycles"); err != nil {
		return err
	}
	cyclesPage, err := whoopdata.List[whoopdata.Cycle](ctx, client, "/cycle", "")
	totalCycles := 0
	for page := 1; ; page++ {
		if err != nil {
			return fmt.Errorf("listing cycles (page %d): %w", page, err)
		}
		totalCycles += len(cyclesPage.Records)
		p.logger.Debug("Processing cycles page", "page", page, "records", len(cyclesPage.Records))

		if err := p.storage.UpsertCycles(ctx, internalUserID, cyclesPage.Records); err != nil {
			return fmt.Errorf("persistindo cycles: %w", err)
		}

		if cyclesPage.NextToken == "" {
			break
		}
		if err := p.waitForRateLimit(ctx, "cycles_next"); err != nil {
			return err
		}
		nextToken := cyclesPage.NextToken
		cyclesPage, err = whoopdata.List[whoopdata.Cycle](ctx, client, "/cycle", nextToken)
		if err == nil && cyclesPage.NextToken == nextToken {
			return errors.New("A paginação WHOOP não avançou.")
		}
	}
	p.logger.Info("Cycles sync completed", "total", totalCycles)

	// --- Recoveries ---
	if err := p.waitForRateLimit(ctx, "recoveries"); err != nil {
		return err
	}
	recoveriesPage, err := whoopdata.List[whoopdata.Recovery](ctx, client, "/recovery", "")
	totalRecoveries := 0
	for page := 1; ; page++ {
		if err != nil {
			return fmt.Errorf("listing recoveries (page %d): %w", page, err)
		}
		totalRecoveries += len(recoveriesPage.Records)
		p.logger.Debug("Processing recoveries page", "page", page, "records", len(recoveriesPage.Records))

		if err := p.storage.UpsertRecoveries(ctx, internalUserID, recoveriesPage.Records); err != nil {
			return fmt.Errorf("persistindo recoveries: %w", err)
		}

		if recoveriesPage.NextToken == "" {
			break
		}
		if err := p.waitForRateLimit(ctx, "recoveries_next"); err != nil {
			return err
		}
		nextToken := recoveriesPage.NextToken
		recoveriesPage, err = whoopdata.List[whoopdata.Recovery](ctx, client, "/recovery", nextToken)
		if err == nil && recoveriesPage.NextToken == nextToken {
			return errors.New("A paginação WHOOP não avançou.")
		}
	}
	p.logger.Info("Recoveries sync completed", "total", totalRecoveries)

	return nil
}

func (p *Poller) pollWorkouts(ctx context.Context) error {
	client, err := p.authManager.GetClient(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting client: %w", err)
	}
	internalUserID, err := p.authManager.GetInternalUserID(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting internal user ID: %w", err)
	}

	if err := p.waitForRateLimit(ctx, "workouts"); err != nil {
		return err
	}
	workoutsPage, err := whoopdata.List[whoopdata.Workout](ctx, client, "/activity/workout", "")
	totalWorkouts := 0
	for page := 1; ; page++ {
		if err != nil {
			return fmt.Errorf("listing workouts (page %d): %w", page, err)
		}
		totalWorkouts += len(workoutsPage.Records)
		p.logger.Debug("Processing workouts page", "page", page, "records", len(workoutsPage.Records))

		if err := p.storage.UpsertWorkouts(ctx, internalUserID, workoutsPage.Records); err != nil {
			return fmt.Errorf("persistindo workouts: %w", err)
		}

		if workoutsPage.NextToken == "" {
			break
		}
		if err := p.waitForRateLimit(ctx, "workouts_next"); err != nil {
			return err
		}
		nextToken := workoutsPage.NextToken
		workoutsPage, err = whoopdata.List[whoopdata.Workout](ctx, client, "/activity/workout", nextToken)
		if err == nil && workoutsPage.NextToken == nextToken {
			return errors.New("A paginação WHOOP não avançou.")
		}
	}
	p.logger.Info("Workouts sync completed", "total", totalWorkouts)
	return nil
}

func (p *Poller) pollSleeps(ctx context.Context) error {

	client, err := p.authManager.GetClient(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting client: %w", err)
	}
	internalUserID, err := p.authManager.GetInternalUserID(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting internal user ID: %w", err)
	}

	if err := p.waitForRateLimit(ctx, "sleeps"); err != nil {
		return err
	}
	sleepsPage, err := whoopdata.List[whoopdata.Sleep](ctx, client, "/activity/sleep", "")
	totalSleeps := 0
	for page := 1; ; page++ {
		if err != nil {
			return fmt.Errorf("listing sleeps (page %d): %w", page, err)
		}
		totalSleeps += len(sleepsPage.Records)
		p.logger.Debug("Processing sleeps page", "page", page, "records", len(sleepsPage.Records))

		if err := p.storage.UpsertSleeps(ctx, internalUserID, sleepsPage.Records); err != nil {
			return fmt.Errorf("persistindo sleeps: %w", err)
		}

		if sleepsPage.NextToken == "" {
			break
		}
		if err := p.waitForRateLimit(ctx, "sleeps_next"); err != nil {
			return err
		}
		nextToken := sleepsPage.NextToken
		sleepsPage, err = whoopdata.List[whoopdata.Sleep](ctx, client, "/activity/sleep", nextToken)
		if err == nil && sleepsPage.NextToken == nextToken {
			return errors.New("A paginação WHOOP não avançou.")
		}
	}
	p.logger.Info("Sleeps sync completed", "total", totalSleeps)
	return nil
}

func (p *Poller) pollUserProfile(ctx context.Context) error {
	client, err := p.authManager.GetClient(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting client: %w", err)
	}
	internalUserID, err := p.authManager.GetInternalUserID(ctx, p.whoopUserID)
	if err != nil {
		return fmt.Errorf("getting internal user ID: %w", err)
	}

	if err := p.waitForRateLimit(ctx, "profile"); err != nil {
		return err
	}

	profile, err := client.User.GetBasicProfile(ctx)
	if err != nil {
		return fmt.Errorf("fetching profile: %w", err)
	}
	if err := p.storage.UpsertUserProfile(ctx, internalUserID, profile); err != nil {
		return fmt.Errorf("upserting profile: %w", err)
	}

	if err := p.waitForRateLimit(ctx, "measurement"); err != nil {
		return err
	}
	measurement, err := client.User.GetBodyMeasurement(ctx)
	if err != nil {
		return fmt.Errorf("fetching body measurement: %w", err)
	}
	if err := p.storage.UpsertBodyMeasurement(ctx, internalUserID, measurement); err != nil {
		return fmt.Errorf("upserting body measurement: %w", err)
	}

	p.logger.Info("Profile and measurements updated")
	return nil
}
