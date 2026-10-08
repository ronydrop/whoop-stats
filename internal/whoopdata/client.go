package whoopdata

import (
	"context"
	"fmt"
	"github.com/arvarik/whoop-go/whoop"
	"net/url"
)

type Page[T any] struct {
	Records   []T    `json:"records"`
	NextToken string `json:"next_token"`
}

func List[T any](ctx context.Context, client *whoop.Client, path, cursor string) (Page[T], error) {
	var page Page[T]
	query := url.Values{"limit": {"25"}}
	if cursor != "" {
		query.Set("nextToken", cursor)
	}
	err := client.Get(ctx, path+"?"+query.Encode(), &page)
	if err != nil {
		return page, fmt.Errorf("consultando WHOOP %s: %w", path, err)
	}
	return page, nil
}
func Get[T any](ctx context.Context, client *whoop.Client, path string) (*T, error) {
	var record T
	if err := client.Get(ctx, path, &record); err != nil {
		return nil, err
	}
	return &record, nil
}
