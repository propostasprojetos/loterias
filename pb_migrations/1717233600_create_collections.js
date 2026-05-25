migrate((app) => {
  const bets = new Collection({
    name: "bets",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "bet_date", type: "text", required: true },
      { name: "lottery_type", type: "text", required: true },
      { name: "game_count", type: "number", required: true },
      { name: "total_cost", type: "number", required: true },
      { name: "contest_number", type: "number", required: false },
      { name: "games", type: "json", required: false },
      { name: "generation_mode", type: "text", required: false },
      { name: "notes", type: "text", required: false }
    ]
  });

  const prizes = new Collection({
    name: "prizes",
    type: "base",
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: "",
    fields: [
      { name: "prize_date", type: "text", required: true },
      { name: "lottery_type", type: "text", required: true },
      { name: "contest_number", type: "number", required: false },
      { name: "matches", type: "number", required: true },
      { name: "prize_amount", type: "number", required: true },
      { name: "winning_games_count", type: "number", required: false },
      { name: "bet_id", type: "text", required: false },
      { name: "notes", type: "text", required: false }
    ]
  });

  app.save(bets);
  app.save(prizes);
}, (app) => {
  const bets = app.findCollectionByNameOrId("bets");
  if (bets) {
    app.delete(bets);
  }
  const prizes = app.findCollectionByNameOrId("prizes");
  if (prizes) {
    app.delete(prizes);
  }
});
