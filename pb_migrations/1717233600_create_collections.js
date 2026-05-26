migrate((app) => {
  // 1. Update users collection with custom fields
  const users = app.findCollectionByNameOrId("users");
  if (users) {
    // Check if fields already exist before adding
    const fieldsMap = {};
    users.fields.forEach(f => { fieldsMap[f.name] = true; });

    if (!fieldsMap["role"]) {
      users.fields.add(new SchemaField({
        name: "role",
        type: "select",
        required: true,
        options: {
          values: ["admin", "usuario"],
          maxSelect: 1
        }
      }));
    }
    if (!fieldsMap["must_change_password"]) {
      users.fields.add(new SchemaField({
        name: "must_change_password",
        type: "bool",
        required: false
      }));
    }
    if (!fieldsMap["ativo"]) {
      users.fields.add(new SchemaField({
        name: "ativo",
        type: "bool",
        required: false
      }));
    }
    if (!fieldsMap["ultimo_login"]) {
      users.fields.add(new SchemaField({
        name: "ultimo_login",
        type: "text",
        required: false
      }));
    }
    users.listRule = "@request.auth.role = 'admin' || id = @request.auth.id";
    users.viewRule = "@request.auth.role = 'admin' || id = @request.auth.id";
    users.createRule = "@request.auth.role = 'admin'";
    users.updateRule = "@request.auth.role = 'admin' || id = @request.auth.id";
    users.deleteRule = "@request.auth.role = 'admin'";
    app.save(users);
  }

  // 2. Create bets and prizes collections with owner_id and access rules
  const bets = new Collection({
    name: "bets",
    type: "base",
    listRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    viewRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    createRule: "@request.auth.id != ''",
    updateRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    deleteRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    fields: [
      { name: "bet_date", type: "text", required: true },
      { name: "lottery_type", type: "text", required: true },
      { name: "game_count", type: "number", required: true },
      { name: "total_cost", type: "number", required: true },
      { name: "contest_number", type: "number", required: false },
      { name: "games", type: "json", required: false },
      { name: "generation_mode", type: "text", required: false },
      { name: "notes", type: "text", required: false },
      { name: "owner_id", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 } }
    ]
  });

  const prizes = new Collection({
    name: "prizes",
    type: "base",
    listRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    viewRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    createRule: "@request.auth.id != ''",
    updateRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    deleteRule: "owner_id = @request.auth.id || @request.auth.role = 'admin'",
    fields: [
      { name: "prize_date", type: "text", required: true },
      { name: "lottery_type", type: "text", required: true },
      { name: "contest_number", type: "number", required: false },
      { name: "matches", type: "number", required: true },
      { name: "prize_amount", type: "number", required: true },
      { name: "winning_games_count", type: "number", required: false },
      { name: "bet_id", type: "text", required: false },
      { name: "notes", type: "text", required: false },
      { name: "owner_id", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 } }
    ]
  });

  const audit_logs = new Collection({
    name: "audit_logs",
    type: "base",
    listRule: "@request.auth.role = 'admin'",
    viewRule: "@request.auth.role = 'admin'",
    createRule: "@request.auth.id != ''",
    updateRule: "false",
    deleteRule: "false",
    fields: [
      { name: "action", type: "text", required: true },
      { name: "user_id", type: "relation", required: true, options: { collectionId: "_pb_users_auth_", cascadeDelete: true, maxSelect: 1 } },
      { name: "target_id", type: "text", required: false },
      { name: "details", type: "json", required: false }
    ]
  });

  app.save(bets);
  app.save(prizes);
  app.save(audit_logs);
}, (app) => {
  const bets = app.findCollectionByNameOrId("bets");
  if (bets) {
    app.delete(bets);
  }
  const prizes = app.findCollectionByNameOrId("prizes");
  if (prizes) {
    app.delete(prizes);
  }
  const audit_logs = app.findCollectionByNameOrId("audit_logs");
  if (audit_logs) {
    app.delete(audit_logs);
  }
});
