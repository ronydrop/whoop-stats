const names: Record<string, string> = {
  running: "Corrida", walking: "Caminhada", weightlifting: "Musculação", "weightlifting-msk": "Strength Trainer", powerlifting: "Levantamento de força",
  cycling: "Ciclismo", swimming: "Natação", yoga: "Ioga", tennis: "Tênis",
  "hiking-rucking": "Trilha com mochila", hiking: "Trilha", rucking: "Caminhada com carga",
  activity: "Atividade", "functional-fitness": "Treino funcional", crossfit: "CrossFit",
  "high-intensity-interval-training": "Treino intervalado de alta intensidade",
  hiit: "Treino intervalado de alta intensidade", "strength-training": "Treino de força",
  "traditional-strength-training": "Musculação", "functional-strength-training": "Treino de força funcional",
  soccer: "Futebol", football: "Futebol americano", basketball: "Basquete",
  volleyball: "Vôlei", boxing: "Boxe", pilates: "Pilates", rowing: "Remo",
  golf: "Golfe", surfing: "Surfe", climbing: "Escalada", dancing: "Dança",
  elliptical: "Elíptico", spinning: "Ciclismo indoor", "indoor-cycling": "Ciclismo indoor",
  stairmaster: "Escada", "stair-climbing": "Subida de escadas", meditation: "Meditação",
  stretching: "Alongamento", "jumping-rope": "Pular corda", "mountain-biking": "Mountain bike",
  skiing: "Esqui", snowboarding: "Snowboard", skateboarding: "Skate",
  kayaking: "Caiaque", sailing: "Vela", "ice-hockey": "Hóquei no gelo",
  "martial-arts": "Artes marciais", "jiu-jitsu": "Jiu-jítsu", "mixed-martial-arts": "Artes marciais mistas",
  pickleball: "Pickleball", badminton: "Badminton", squash: "Squash", padel: "Padel",
  recovery: "Recuperação", other: "Outra atividade", exercise: "Exercício",
};

export function sportLabel(name: string): string {
  const key = name.trim().toLowerCase().replace(/[ _]+/g, "-");
  return names[key] ?? name;
}
