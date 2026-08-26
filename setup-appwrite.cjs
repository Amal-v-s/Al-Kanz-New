const sdk = require("node-appwrite");

const endpoint =
  process.env.APPWRITE_ENDPOINT || "https://sgp.cloud.appwrite.io/v1";

const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!projectId) {
  console.error("❌ APPWRITE_PROJECT_ID is missing");
  process.exit(1);
}

if (!apiKey) {
  console.error("❌ APPWRITE_API_KEY is missing");
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
  console.log("Starting Appwrite setup...\n");

  // Create / verify database
  try {
    await tablesDB.get({
      databaseId: DATABASE_ID,
    });

    console.log("✓ Database exists:", DATABASE_ID);
  } catch (error) {
    if (error.code !== 404) {
      throw error;
    }

    await tablesDB.create({
      databaseId: DATABASE_ID,
      name: "Al Kanz Database",
      enabled: true,
    });

    console.log("✓ Database created:", DATABASE_ID);
  }

  // Create / verify table
  try {
    await tablesDB.getTable({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
    });

    console.log("✓ Table exists:", TABLE_ID);
  } catch (error) {
    if (error.code !== 404) {
      throw error;
    }

    await tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId: TABLE_ID,
      name: "Application State",
      enabled: true,
      rowSecurity: false,
      permissions: [
        sdk.Permission.read(sdk.Role.any()),
        sdk.Permission.write(sdk.Role.any()),
      ],
    });

    console.log("✓ Table created:", TABLE_ID);
  }

  // Check columns
  const result = await tablesDB.listColumns({
    databaseId: DATABASE_ID,
    tableId: TABLE_ID,
  });

  const existingColumns = (result.columns || []).map(
    (column) => column.key
  );

  // table_name
  if (!existingColumns.includes("table_name")) {
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

  // payload
  if (!existingColumns.includes("payload")) {
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

  console.log("\n🎉 Appwrite setup complete!");
  console.log("Database:", DATABASE_ID);
  console.log("Table:", TABLE_ID);
}

main().catch((error) => {
  console.error("\n❌ Appwrite setup failed:");
  console.error(error);
  process.exit(1);
});
