cat > setup-appwrite.cjs <<'EOF'
const sdk = require("node-appwrite");

const endpoint =
  process.env.APPWRITE_ENDPOINT || "https://cloud.appwrite.io/v1";

const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId || !apiKey) {
  console.error("❌ Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY");
  process.exit(1);
}

const client = new sdk.Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tablesDB = new sdk.TablesDB(client);

const DATABASE_ID = "al-kanz-db";
const TABLE_ID = "app_state";

async function main() {
  // Database
  try {
    await tablesDB.get({
      databaseId: DATABASE_ID,
    });

    console.log("✓ Database exists:", DATABASE_ID);
  } catch (error) {
    if (error.code !== 404) throw error;

    await tablesDB.create({
      databaseId: DATABASE_ID,
      name: "Al Kanz Database",
      enabled: true,
    });

    console.log("✓ Database created:", DATABASE_ID);
  }

  // Table
  try {
    await tablesDB.getTable({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
    });

    console.log("✓ Table exists:", TABLE_ID);
  } catch (error) {
    if (error.code !== 404) throw error;

    await tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      name: "Application State",
      permissions: [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.write(sdk.Role.any()),
      ],
      rowSecurity: false,
      enabled: true,
    });

    console.log("✓ Table created:", TABLE_ID);
  }

  // Columns
  const columns = await tablesDB.listColumns({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
    total: false,
  });

  const existing = (columns.columns || []).map((c) => c.key);

  if (!existing.includes("table_name")) {
    await tablesDB.createStringColumn({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      key: "table_name",
      size: 64,
      required: true,
    });

    console.log("✓ Column created: table_name");
  } else {
    console.log("✓ Column exists: table_name");
  }

  if (!existing.includes("payload")) {
    await tablesDB.createLongtextColumn({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      key: "payload",
      required: true,
    });

    console.log("✓ Column created: payload");
  } else {
    console.log("✓ Column exists: payload");
  }

  console.log("");
  console.log("🎉 Appwrite setup complete!");
  console.log("Database:", DATABASE_ID);
  console.log("Table:", TABLE_ID);
}

main().catch((error) => {
  console.error("");
  console.error("❌ Appwrite setup failed:");
  console.error(error);
  process.exit(1);
});
EOF