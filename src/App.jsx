import React, { useEffect, useMemo, useState } from "react";
import { databases, ID, Query } from "./lib/appwrite";

// Appwrite compatibility layer for the existing Al Kanz UI.
// It keeps the existing CRUD code readable while removing Supabase.
const hasSupabase = true;

// ---------------------------------------------------------------------------
// Appwrite compatibility layer
// ---------------------------------------------------------------------------
// The original UI was written around Supabase's `from(...).select()/insert()`
// API.  To avoid forcing you to create 10+ Appwrite schemas immediately, this
// adapter stores each logical table as a row in one physical Appwrite table:
//   database: al-kanz-db
//   table:    app_state
//   columns:  table_name, payload
// The rest of the UI can keep using the existing Supabase-style calls.

const STATE_DATABASE_ID = "al-kanz-db";
const STATE_TABLE_ID = "app_state";

const mapAppwriteRow = (row) => ({
  ...row,
  id: row.id || row.$id,
  created_at: row.created_at || row.$createdAt,
  updated_at: row.updated_at || row.$updatedAt,
});

const normalizeData = (table, data) => {
  const value = { ...data };
  if (table === "audit_logs" && value.details && typeof value.details !== "string") {
    value.details = JSON.stringify(value.details);
  }
  if (table === "expenses") {
    delete value.account;
    delete value.reference;
  }
  if (table === "money_transfers") delete value.reference;
  if (table === "transactions") {
    delete value.expense_id;
    delete value.transfer_id;
  }
  return value;
};

const getNestedValue = (row, field) => {
  if (field === "id") return row.id || row.$id;
  if (field === "created_at") return row.created_at || row.$createdAt;
  if (field === "updated_at") return row.updated_at || row.$updatedAt;
  return row[field];
};

function createAppwriteQuery(table) {
  let operation = "select";
  let payload = {};
  const filters = [];
  let orderBy = null;
  let limitCount = null;
  let single = false;
  let maybeSingle = false;

  const builder = {
    select() { return builder; },
    eq(field, value) {
      filters.push({ type: "eq", field, value });
      return builder;
    },
    ilike(field, value) {
      filters.push({ type: "ilike", field, value });
      return builder;
    },
    order(field, { ascending = true } = {}) {
      orderBy = { field, ascending };
      return builder;
    },
    limit(n) {
      limitCount = Number(n);
      return builder;
    },
    single() { single = true; return builder; },
    maybeSingle() { maybeSingle = true; return builder; },
    insert(data) {
      operation = "insert";
      payload = Array.isArray(data) ? data[0] : data;
      return builder;
    },
    update(data) {
      operation = "update";
      payload = data;
      return builder;
    },
    async execute() {
      try {
        const result = await databases.listRows({
          databaseId: STATE_DATABASE_ID,
          tableId: STATE_TABLE_ID,
          queries: [],
          total: false,
        });

        let stateRows = (result.rows || []).filter((r) => r.table_name === table);
        let rows = stateRows.map((r) => {
          let data = {};
          try { data = r.payload ? JSON.parse(r.payload) : {}; } catch { data = {}; }
          return mapAppwriteRow({
            ...data,
            $id: r.$id,
            $createdAt: r.$createdAt,
            $updatedAt: r.$updatedAt,
          });
        });

        for (const filter of filters) {
          rows = rows.filter((row) => {
            const actual = getNestedValue(row, filter.field);
            if (filter.type === "eq") {
              return String(actual ?? "") === String(filter.value ?? "");
            }
            return String(actual ?? "").toLowerCase().includes(
              String(filter.value ?? "").replace(/^%|%$/g, "").toLowerCase()
            );
          });
        }

        if (orderBy) {
          const { field, ascending } = orderBy;
          rows.sort((a, b) => {
            const av = getNestedValue(a, field);
            const bv = getNestedValue(b, field);
            const ad = new Date(av).getTime();
            const bd = new Date(bv).getTime();
            const comparableA = Number.isNaN(ad) ? String(av ?? "") : ad;
            const comparableB = Number.isNaN(bd) ? String(bv ?? "") : bd;
            if (comparableA < comparableB) return ascending ? -1 : 1;
            if (comparableA > comparableB) return ascending ? 1 : -1;
            return 0;
          });
        }

        if (limitCount != null) rows = rows.slice(0, limitCount);

        if (operation === "select") {
          if (single) {
            if (!rows[0]) return { data: null, error: { message: `No ${table} row found` } };
            return { data: rows[0], error: null };
          }
          if (maybeSingle) return { data: rows[0] || null, error: null };
          return { data: rows, error: null };
        }

        if (operation === "insert") {
          const clean = normalizeData(table, payload);
          const row = await databases.createRow({
            databaseId: STATE_DATABASE_ID,
            tableId: STATE_TABLE_ID,
            rowId: ID.unique(),
            data: {
              table_name: table,
              payload: JSON.stringify(clean),
            },
          });
          return {
            data: mapAppwriteRow({ ...clean, $id: row.$id, $createdAt: row.$createdAt, $updatedAt: row.$updatedAt }),
            error: null,
          };
        }

        if (operation === "update") {
          if (!rows[0]) return { data: null, error: { message: `No ${table} row matched update` } };
          const physical = await databases.getRow({
            databaseId: STATE_DATABASE_ID,
            tableId: STATE_TABLE_ID,
            rowId: rows[0].id,
          });
          let existing = {};
          try { existing = physical.payload ? JSON.parse(physical.payload) : {}; } catch { existing = {}; }
          const merged = normalizeData(table, { ...existing, ...payload });
          const row = await databases.updateRow({
            databaseId: STATE_DATABASE_ID,
            tableId: STATE_TABLE_ID,
            rowId: rows[0].id,
            data: { table_name: table, payload: JSON.stringify(merged) },
          });
          return {
            data: mapAppwriteRow({ ...merged, $id: row.$id, $createdAt: row.$createdAt, $updatedAt: row.$updatedAt }),
            error: null,
          };
        }
      } catch (error) {
        console.error(`Appwrite ${operation} ${table} failed:`, error);
        return { data: null, error };
      }
    },
    then(resolve, reject) { return builder.execute().then(resolve, reject); },
  };

  return builder;
}

const supabase = { from: createAppwriteQuery };

import {
  LayoutDashboard,
  Wrench,
  Users,
  Package,
  Truck,
  UserRound,
  Receipt,
  BarChart3,
  Wallet,
  Settings,
  ShieldCheck,
  FileText,
  ArrowLeftRight,
  Plus,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  Sofa,
  Armchair,
  Car,
  Scissors,
  Clock3,
  CheckCircle2,
  CircleDollarSign,
  CalendarDays,
  MoreHorizontal,
  ArrowUpRight,
  Phone,
  MapPin,
  X,
  Menu,
  ClipboardList,
  CreditCard,
  Banknote,
  TrendingUp,
  AlertCircle,
  Eye,
  Edit3,
  Trash2,
  Save,
  LogOut,
  Lock,
  UserCog,
  Layers3,
  Database,
  ReceiptText,
  Printer,
} from "lucide-react";

/* ============================================================
   AL KANZ UPHOLSTERY
   COMPLETE SINGLE-FILE APPLICATION
============================================================ */

const INITIAL_JOBS = [
  {
    id: "AK-1048",
    customer: "Ahmed Rahman",
    phone: "+971 50 123 4567",
    item: "3-Seater Sofa",
    work: "Full Leather Replacement",
    material: "Premium Leather",
    amount: 28000,
    paid: 12000,
    status: "In Progress",
    progress: 75,
    date: "21 Aug 2026",
  },
  {
    id: "AK-1047",
    customer: "Nabeel Ahmed",
    phone: "+971 52 234 5678",
    item: "Leather Recliner",
    work: "Repair & Stitching",
    material: "Brown Leather",
    amount: 12000,
    paid: 5000,
    status: "In Progress",
    progress: 55,
    date: "21 Aug 2026",
  },
  {
    id: "AK-1046",
    customer: "Sameer Khan",
    phone: "+971 55 345 6789",
    item: "Office Sofa Set",
    work: "Fabric Replacement",
    material: "Velvet Fabric",
    amount: 18500,
    paid: 10000,
    status: "Ready",
    progress: 100,
    date: "20 Aug 2026",
  },
  {
    id: "AK-1045",
    customer: "Faris Traders",
    phone: "+971 4 345 6789",
    item: "6 Dining Chairs",
    work: "Seat Upholstery",
    material: "Synthetic Leather",
    amount: 9000,
    paid: 9000,
    status: "Delivered",
    progress: 100,
    date: "19 Aug 2026",
  },
];

const INITIAL_CUSTOMERS = [
  {
    id: 1,
    name: "Ahmed Rahman",
    phone: "+971 50 123 4567",
    location: "Dubai",
    jobs: 3,
    outstanding: 16000,
  },
  {
    id: 2,
    name: "Nabeel Ahmed",
    phone: "+971 52 234 5678",
    location: "Dubai",
    jobs: 2,
    outstanding: 7000,
  },
  {
    id: 3,
    name: "Sameer Khan",
    phone: "+971 55 345 6789",
    location: "Sharjah",
    jobs: 4,
    outstanding: 8500,
  },
  {
    id: 4,
    name: "Faris Traders",
    phone: "+971 4 345 6789",
    location: "Dubai",
    jobs: 6,
    outstanding: 0,
  },
];

const INITIAL_MATERIALS = [
  {
    id: 1,
    name: "Premium Black Leather",
    category: "Leather",
    unit: "Meter",
    stock: 42,
    price: 850,
  },
  {
    id: 2,
    name: "Brown Automotive Leather",
    category: "Leather",
    unit: "Meter",
    stock: 28,
    price: 950,
  },
  {
    id: 3,
    name: "Grey Velvet",
    category: "Fabric",
    unit: "Meter",
    stock: 65,
    price: 420,
  },
  {
    id: 4,
    name: "High Density Foam",
    category: "Foam",
    unit: "Sheet",
    stock: 18,
    price: 1200,
  },
];

const INITIAL_SUPPLIERS = [
  {
    id: 1,
    name: "Leather World",
    phone: "+971 4 321 1122",
    material: "Leather",
    balance: 18500,
  },
  {
    id: 2,
    name: "Modern Fabrics",
    phone: "+971 4 322 2233",
    material: "Fabric",
    balance: 7200,
  },
  {
    id: 3,
    name: "Foam House",
    phone: "+971 4 323 3344",
    material: "Foam",
    balance: 4500,
  },
];

const INITIAL_STAFF = [
  {
    id: 1,
    name: "Mohammed Afsal",
    role: "Master Upholsterer",
    phone: "+971 50 456 7890",
    status: "Active",
  },
  {
    id: 2,
    name: "Shameer",
    role: "Leather Technician",
    phone: "+971 52 567 8901",
    status: "Active",
  },
  {
    id: 3,
    name: "Riyas",
    role: "Stitching Specialist",
    phone: "+971 55 678 9012",
    status: "On Leave",
  },
];

const NAVIGATION = [
  {
    section: "WORKSPACE",
    items: [
      {
        name: "Dashboard",
        icon: LayoutDashboard,
      },
      {
        name: "Jobs & Repairs",
        icon: Wrench,
        children: [
          "New Repair Job",
          "Active Jobs",
          "Completed Jobs",
          "Delivered",
        ],
      },
      {
        name: "Customers",
        icon: Users,
      },
      {
        name: "Materials",
        icon: Package,
      },
      {
        name: "Suppliers",
        icon: Truck,
      },
      {
        name: "Staff",
        icon: UserRound,
      },
    ],
  },
  {
    section: "BILLING",
    items: [
      {
        name: "Billing",
        icon: Receipt,
        children: ["Main", "Transactions", "Invoices", "Payments"],
      },
    ],
  },
  {
    section: "FINANCE",
    items: [
      {
        name: "Reports",
        icon: BarChart3,
      },
      {
        name: "Accounts",
        icon: Wallet,
        children: ["Ledger", "Expenses", "Move Money"],
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        name: "Settings",
        icon: Settings,
        children: ["User", "Audit & Security"],
      },
    ],
  },
];

const money = (value) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const LOCAL_KEY = "al-kanz-uae-data-v2";

const safeParse = (value, fallback) => {
  try { return value ? JSON.parse(value) : fallback; }
  catch { return fallback; }
};

const loadLocalData = () => {
  const raw = safeParse(localStorage.getItem(LOCAL_KEY), null);
  return raw || {
    jobs: INITIAL_JOBS,
    customers: INITIAL_CUSTOMERS,
    materials: INITIAL_MATERIALS,
    suppliers: INITIAL_SUPPLIERS,
    staff: INITIAL_STAFF,
    payments: [],
    expenses: [],
    transfers: [],
    transactions: [],
  };
};

const auditLocal = (action, entity, id, details = {}) => {
  const data = loadLocalData();
  const logs = data.auditLogs || [];
  logs.unshift({
    id: Date.now().toString(),
    action,
    entity,
    entityId: id,
    details,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...data, auditLogs: logs.slice(0, 500) }));
};

const mapJob = (row) => ({
  id: row.job_number,
  customer: row.customer_name,
  phone: row.phone || "",
  item: row.item,
  description: row.description || "",
  work: row.work || "",
  material: row.material || "",
  colour: row.colour || "",
  quantity: Number(row.quantity || 1),
  materialCost: Number(row.material_cost || 0),
  labour: Number(row.labour || 0),
  otherCharges: Number(row.other_charges || 0),
  discount: Number(row.discount || 0),
  amount: Number(row.amount || 0),
  paid: Number(row.paid || 0),
  balance: Math.max(0, Number(row.amount || 0) - Number(row.paid || 0)),
  status: row.status || "Received",
  progress: Number(row.progress || 0),
  deliveryDate: row.delivery_date || "",
  notes: row.notes || "",
  date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-AE", { day:"2-digit", month:"short", year:"numeric", timeZone:"Asia/Dubai" }) : "",
  dbId: row.id,
});

const mapCustomer = (row) => ({
  id: row.id,
  name: row.name,
  phone: row.phone || "",
  location: row.location || "Dubai",
  address: row.address || "",
  jobs: Number(row.jobs_count || 0),
  outstanding: Number(row.outstanding || 0),
});

const mapMaterial = (row) => ({
  id: row.id,
  name: row.name,
  category: row.category,
  unit: row.unit,
  stock: Number(row.stock || 0),
  price: Number(row.price || 0),
});

const mapSupplier = (row) => ({
  id: row.id, name: row.name, phone: row.phone || "", material: row.material || "", balance: Number(row.balance || 0)
});

const mapStaff = (row) => ({
  id: row.id, name: row.name, role: row.role || "", phone: row.phone || "", status: row.status || "Active"
});

function App() {
  const [page, setPage] = useState("Dashboard");
  const [jobs, setJobs] = useState(() => loadLocalData().jobs || INITIAL_JOBS);
  const [customers, setCustomers] = useState(() => loadLocalData().customers || INITIAL_CUSTOMERS);
  const [materials, setMaterials] = useState(() => loadLocalData().materials || INITIAL_MATERIALS);
  const [suppliers, setSuppliers] = useState(() => loadLocalData().suppliers || INITIAL_SUPPLIERS);
  const [staff, setStaff] = useState(() => loadLocalData().staff || INITIAL_STAFF);
  const [payments, setPayments] = useState(() => loadLocalData().payments || []);
  const [expenses, setExpenses] = useState(() => loadLocalData().expenses || []);
  const [transfers, setTransfers] = useState(() => loadLocalData().transfers || []);
  const [transactions, setTransactions] = useState(() => loadLocalData().transactions || []);
  const [auditLogs, setAuditLogs] = useState(() => loadLocalData().auditLogs || []);
  const [loadingData, setLoadingData] = useState(false);
  const [dbReady, setDbReady] = useState(hasSupabase);

  const [openSections, setOpenSections] = useState(() => new Set(["Jobs & Repairs"]));

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("al-kanz-theme") || "default");
  const [modal, setModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState("");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    const local = loadLocalData();
    if (!hasSupabase) return;

    const loadRemote = async () => {
      setLoadingData(true);
      try {
        const [j, c, m, s, st, p, e, tr, tx, al] = await Promise.all([
          supabase.from("jobs").select("*").order("created_at", { ascending: false }),
          supabase.from("customers").select("*").order("created_at", { ascending: false }),
          supabase.from("materials").select("*").order("created_at", { ascending: false }),
          supabase.from("suppliers").select("*").order("created_at", { ascending: false }),
          supabase.from("staff").select("*").order("created_at", { ascending: false }),
          supabase.from("payments").select("*").order("paid_at", { ascending: false }),
          supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
          supabase.from("money_transfers").select("*").order("transfer_date", { ascending: false }),
          supabase.from("transactions").select("*").order("transaction_date", { ascending: false }),
          supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500),
        ]);
        const err = [j,c,m,s,st,p,e,tr,tx,al].find(x => x.error);
        if (err?.error) throw err.error;

        setJobs((j.data || []).map(mapJob));
        setCustomers((c.data || []).map(mapCustomer));
        setMaterials((m.data || []).map(mapMaterial));
        setSuppliers((s.data || []).map(mapSupplier));
        setStaff((st.data || []).map(mapStaff));
        setPayments(p.data || []);
        setExpenses(e.data || []);
        setTransfers(tr.data || []);
        setTransactions(tx.data || []);
        setAuditLogs(al.data || []);
        setDbReady(true);
      } catch (error) {
        console.error("Al Kanz database load failed:", error);
        setDbReady(false);
      } finally {
        setLoadingData(false);
      }
    };
    loadRemote();
  }, []);

  useEffect(() => {
    const data = { jobs, customers, materials, suppliers, staff, payments, expenses, transfers, transactions, auditLogs };
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }, [jobs, customers, materials, suppliers, staff, payments, expenses, transfers, transactions, auditLogs]);

  useEffect(() => {
    localStorage.setItem("al-kanz-theme", theme);
  }, [theme]);

  const totalSales = jobs.reduce(
  (a, b) => a + Number(b.amount || 0),
  0
);

const totalPaid = jobs.reduce(
  (a, b) => a + Number(b.paid || 0),
  0
);

const outstanding = totalSales - totalPaid;

const totalExpenses = expenses.reduce(
  (a, b) => a + Number(b.amount || 0),
  0
);

const netCash = totalPaid - totalExpenses;

  const activeJobs = jobs.filter(
    (j) => j.status === "In Progress"
  ).length;

  const readyJobs = jobs.filter(
    (j) => j.status === "Ready"
  ).length;

  const getParentSection = (name) => {
    for (const group of NAVIGATION) {
      for (const item of group.items) {
        if (item.children?.includes(name)) return item.name;
      }
    }
    return null;
  };

  const navigate = (name) => {
    setPage(name);
    setSidebarOpen(false);

    // Child navigation never collapses its parent. Each expandable
    // section remembers its own open/closed state independently.
    const parent = getParentSection(name);
    if (parent) {
      setOpenSections((prev) => {
        const next = new Set(prev);
        next.add(parent);
        return next;
      });
    }

    setNotificationOpen(false);
    setAdminMenuOpen(false);

    if (name === "New Repair Job") {
      setModal("job");
    }
  };

  const addJob = async (job) => {
    const id = `AK-${1050 + jobs.length}`;
    const newJob = {
      ...job,
      id,
      date: new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dubai" }),
      progress: 5,
      status: "Received",
      paid: Number(job.paid || 0),
      amount: Number(job.amount || 0),
    };

    setJobs(prev => [newJob, ...prev]);
    setModal(null);
    setPage("Active Jobs");

    if (hasSupabase) {
      try {
        let customerId = null;
        const existing = await supabase.from("customers").select("id").eq("phone", job.phone).limit(1).maybeSingle();
        if (existing.data?.id) customerId = existing.data.id;
        else {
          const created = await supabase.from("customers").insert({ name: job.customer, phone: job.phone, location: "Dubai", jobs_count: 0 }).select("id").single();
          if (created.error) throw created.error;
          customerId = created.data.id;
        }
        const row = {
          job_number: id, customer_id: customerId, customer_name: job.customer, phone: job.phone,
          item: job.item, description: job.description || "", work: job.work, material: job.material || "",
          colour: job.colour || "", quantity: Number(job.quantity || 1), material_cost: Number(job.materialCost || 0),
          labour: Number(job.labour || 0), other_charges: Number(job.otherCharges || 0), discount: Number(job.discount || 0),
          amount: Number(job.amount || 0), paid: Number(job.paid || 0), status: "Received", progress: 5,
          delivery_date: job.deliveryDate || null, notes: job.notes || "",
        };
        const saved = await supabase.from("jobs").insert(row).select("*").single();
        if (saved.error) throw saved.error;
        if (Number(job.paid || 0) > 0) {
          const pay = await supabase.from("payments").insert({ job_id: saved.data.id, customer_id: customerId, amount: Number(job.paid), payment_method: "Cash", notes: "Advance payment" }).select("*").single();
          if (pay.error) throw pay.error;
          await supabase.from("transactions").insert({ transaction_type: "Income", description: `Advance · ${job.customer} · ${id}`, amount: Number(job.paid), account: "Cash", job_id: saved.data.id, customer_id: customerId, payment_id: pay.data.id });
        }
        await supabase.from("audit_logs").insert({ action: "Created repair job", entity_type: "job", entity_id: saved.data.id, details: { job_number: id } });
      } catch (error) {
        console.error("Job save failed:", error);
        alert("Job saved locally, but cloud sync failed. Check Appwrite settings.");
      }
    }
    auditLocal("Created repair job", "job", id, { customer: job.customer });
  };

  const updateJobStatus = async (jobId, status) => {
    setJobs(prev => prev.map(job => job.id === jobId ? { ...job, status } : job));
    if (hasSupabase) {
      const { error } = await supabase.from("jobs").update({ status, updated_at: new Date().toISOString() }).eq("job_number", jobId);
      if (error) console.error("Status update failed:", error);
    }
    auditLocal("Updated job status", "job", jobId, { status });
  };

  const recordPayment = async (jobId, payment) => {
    const amount = Number(payment);
    if (!amount || amount <= 0) return;
    const current = jobs.find(j => j.id === jobId);
    if (!current) return;
    const balance = Math.max(0, Number(current.amount || 0) - Number(current.paid || 0));
    if (amount > balance) { alert("Payment cannot be greater than the balance."); return; }
    const paid = Number(current.paid || 0) + amount;
    setJobs(prev => prev.map(job => job.id === jobId ? { ...job, paid } : job));
    setSelectedJob(prev => prev && prev.id === jobId ? { ...prev, paid } : prev);
    const paymentRow = { id: Date.now().toString(), job_id: jobId, customer: current.customer, amount, payment_method: "Cash", paid_at: new Date().toISOString() };
    setPayments(prev => [paymentRow, ...prev]);
    setTransactions(prev => [{ id: Date.now().toString(), transaction_type: "Income", description: `Payment · ${current.customer} · ${jobId}`, amount, account: "Cash", transaction_date: new Date().toISOString() }, ...prev]);
    if (hasSupabase) {
      try {
        const jobDb = await supabase.from("jobs").select("id,customer_id").eq("job_number", jobId).single();
        if (jobDb.error) throw jobDb.error;
        const pay = await supabase.from("payments").insert({ job_id: jobDb.data.id, customer_id: jobDb.data.customer_id, amount, payment_method: "Cash" }).select("*").single();
        if (pay.error) throw pay.error;
        const upd = await supabase.from("jobs").update({ paid, updated_at: new Date().toISOString() }).eq("id", jobDb.data.id);
        if (upd.error) throw upd.error;
        await supabase.from("transactions").insert({ transaction_type: "Income", description: `Payment · ${current.customer} · ${jobId}`, amount, account: "Cash", job_id: jobDb.data.id, customer_id: jobDb.data.customer_id, payment_id: pay.data.id });
        await supabase.from("audit_logs").insert({ action: "Recorded payment", entity_type: "job", entity_id: jobDb.data.id, details: { job_number: jobId, amount } });
      } catch (error) {
        console.error("Payment sync failed:", error);
        alert("Payment saved locally, but cloud sync failed.");
      }
    }
    auditLocal("Recorded payment", "job", jobId, { amount });
  };

  const addCustomer = async (customer) => {
    const newCustomer = { ...customer, id: Date.now(), jobs: 0, outstanding: 0 };
    setCustomers(prev => [newCustomer, ...prev]);
    setModal(null);
    if (hasSupabase) {
      const { error } = await supabase.from("customers").insert({ name: customer.name, phone: customer.phone, location: customer.location || "Dubai", jobs_count: 0, outstanding: 0 });
      if (error) { console.error("Customer save failed:", error); alert("Customer saved locally, but cloud sync failed."); }
    }
    auditLocal("Created customer", "customer", newCustomer.id, { name: customer.name });
  };

  const addSupplier = async (supplier) => {
    const newSupplier = {
      ...supplier,
      id: Date.now(),
      balance: Number(supplier.balance || 0),
    };
    setSuppliers((prev) => [newSupplier, ...prev]);
    setModal(null);

    if (hasSupabase) {
      try {
        const { error } = await supabase.from("suppliers").insert({
          name: supplier.name,
          phone: supplier.phone,
          material: supplier.material,
          balance: Number(supplier.balance || 0),
        });
        if (error) throw error;
      } catch (error) {
        console.error("Supplier save failed:", error);
        alert("Supplier saved locally, but cloud sync failed.");
      }
    }
    auditLocal("Created supplier", "supplier", newSupplier.id, { name: supplier.name });
  };

  const addStaff = async (person) => {
    const newStaff = {
      ...person,
      id: Date.now(),
    };
    setStaff((prev) => [newStaff, ...prev]);
    setModal(null);

    if (hasSupabase) {
      try {
        const { error } = await supabase.from("staff").insert({
          name: person.name,
          role: person.role,
          phone: person.phone,
          status: person.status,
        });
        if (error) throw error;
      } catch (error) {
        console.error("Staff save failed:", error);
        alert("Staff saved locally, but cloud sync failed.");
      }
    }
    auditLocal("Created staff member", "staff", newStaff.id, { name: person.name });
  };

  const filteredJobs = useMemo(() => {
    const q = search.toLowerCase();

    if (!q) return jobs;

    return jobs.filter(
      (job) =>
        job.customer.toLowerCase().includes(q) ||
        job.item.toLowerCase().includes(q) ||
        job.work.toLowerCase().includes(q) ||
        job.id.toLowerCase().includes(q)
    );
  }, [jobs, search]);

  return (
    <>
      <style>{FINAL_CSS}</style>

      <div className={`app theme-${theme} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={theme}>
        {/* =====================================================
            SIDEBAR
        ===================================================== */}

        <aside
          className={`sidebar ${
            sidebarOpen ? "sidebar-open" : ""
          }`}
        >
          <div className="brand-area">
            <div className="brand">
              <div className="brand-logo">
                <Sofa size={23} />
              </div>

              <div>
                <strong>AL KANZ</strong>
                <span>UPHOLSTERY</span>
              </div>
            </div>

            <button
              className="mobile-close"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={19} />
            </button>

            <div className="workshop-status">
              <span />
              Workshop Open
            </div>
          </div>

          <div className="nav-scroll">
            {NAVIGATION.map((group) => (
              <div className="nav-group" key={group.section}>
                <div className="nav-section-title">
                  {group.section}
                </div>

                {group.items.map((item) => {
                  const Icon = item.icon;
                  const hasChildren =
                    item.children &&
                    item.children.length > 0;

                  return (
                    <div key={item.name}>
                      <button
                        className={`nav-item ${
                          page === item.name
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          if (hasChildren) {
                            setOpenSections((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.name)) next.delete(item.name);
                              else next.add(item.name);
                              return next;
                            });
                            setNotificationOpen(false);
                            setAdminMenuOpen(false);
                          } else {
                            navigate(item.name);
                          }
                        }}
                      >
                        <Icon size={17} />
                        <span>{item.name}</span>

                        {hasChildren && (
                          <ChevronDown
                            size={14}
                            className={
                              openSections.has(item.name)
                                ? "chevron-open"
                                : ""
                            }
                          />
                        )}
                      </button>

                      {hasChildren &&
                        openSections.has(item.name) && (
                          <div className="sub-menu">
                            {item.children.map(
                              (child) => (
                                <button
                                  key={child}
                                  className={
                                    page === child
                                      ? "sub-selected"
                                      : ""
                                  }
                                  onClick={() =>
                                    navigate(child)
                                  }
                                >
                                  <span />
                                  {child}
                                </button>
                              )
                            )}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="sidebar-account">
            <div className="account-card">
              <div className="account-avatar">
                AK
              </div>

              <div>
                <strong>Al Kanz Upholstery</strong>
                <span>Owner account</span>
              </div>

              <MoreHorizontal size={16} />
            </div>

            <button className="logout">
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </aside>

        {sidebarOpen && (
          <button className="sidebar-overlay" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
        )}

        {/* =====================================================
            MAIN
        ===================================================== */}

        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu"
                aria-label="Toggle sidebar"
                onClick={() => {
                  if (window.innerWidth <= 850) setSidebarOpen(true);
                  else setSidebarCollapsed(prev => !prev);
                }}
              >
                <Menu size={21} />
              </button>

              <div className="breadcrumb">
                <span>Al Kanz · Dubai</span>
                <ChevronRight size={13} />
                <strong>{page}</strong>
              </div>
            </div>

            <div className="topbar-right">
              <div className="global-search">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search jobs, customers..."
                />
                <kbd>⌘ K</kbd>
              </div>

              <div className="notification-wrap">
                <button
                  type="button"
                  className={`notification ${notificationOpen ? "active" : ""}`}
                  aria-label="Open notifications"
                  aria-expanded={notificationOpen}
                  onClick={() => {
                    setNotificationOpen(prev => !prev);
                    setAdminMenuOpen(false);
                  }}
                >
                  <Bell size={18} />
                  <i />
                </button>

                {notificationOpen && (
                  <div className="notification-popover">
                    <div className="popover-title">
                      <div>
                        <span>UPDATES</span>
                        <strong>Notifications</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setNotificationOpen(false)}
                        aria-label="Close notifications"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <div className="notification-item">
                      <span className="notification-icon"><Bell size={15} /></span>
                      <div>
                        <strong>Workshop is ready</strong>
                        <p>Check today's jobs, payments and expenses.</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="notification-footer"
                      onClick={() => setNotificationOpen(false)}
                    >
                      Mark as viewed
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-menu-wrap">
                <button
                  type="button"
                  className="admin-profile"
                  onClick={() => setAdminMenuOpen((prev) => !prev)}
                  aria-expanded={adminMenuOpen}
                  aria-label="Open Admin menu"
                >
                  <div>AK</div>
                  <section>
                    <strong>Admin</strong>
                    <span>Owner</span>
                  </section>
                  <ChevronDown
                    size={14}
                    className={adminMenuOpen ? "chevron-open" : ""}
                  />
                </button>

                {adminMenuOpen && (
                  <div className="admin-dropdown">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMenuOpen(false);
                        navigate("User");
                      }}
                    >
                      <UserCog size={15} />
                      <span>My Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMenuOpen(false);
                        navigate("Settings");
                      }}
                    >
                      <Settings size={15} />
                      <span>Settings</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminMenuOpen(false)}
                    >
                      <X size={15} />
                      <span>Close</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="content">
            {page === "Dashboard" && (
              <Dashboard
                totalSales={totalSales}
                activeJobs={activeJobs}
                readyJobs={readyJobs}
                outstanding={outstanding}
                totalPaid={totalPaid}
                jobs={filteredJobs}
                navigate={navigate}
                setModal={setModal}
              />
            )}

            {(page === "Active Jobs" ||
              page === "Completed Jobs" ||
              page === "Delivered") && (
              <JobsPage
                title={page}
                jobs={filteredJobs}
                setModal={setModal}
                onViewJob={setSelectedJob}
              />
            )}

            {page === "Customers" && (
              <CustomersPage
                customers={customers}
                setModal={setModal}
              />
            )}

            {page === "Materials" && (
              <MaterialsPage
                materials={materials}
                setMaterials={setMaterials}
                setModal={setModal}
              />
            )}

            {page === "Suppliers" && (
              <SuppliersPage suppliers={suppliers} setSuppliers={setSuppliers} setModal={setModal} />
            )}

            {page === "Staff" && (
              <StaffPage staff={staff} setStaff={setStaff} setModal={setModal} />
            )}

            {(page === "Billing" ||
              page === "Main" ||
              page === "Invoices" ||
              page === "Payments") && (
              <BillingPage
                page={page}
                jobs={jobs}
                payments={payments}
                outstanding={outstanding}
                totalPaid={totalPaid}
                recordPayment={recordPayment}
              />
            )}

            {page === "Reports" && (
              <ReportsPage
                jobs={jobs}
                totalPaid={totalPaid}
                outstanding={outstanding}
                totalExpenses={totalExpenses}
                netCash={netCash}
                expenses={expenses}
              />
            )}

            {(page === "Accounts" ||
              page === "Ledger" ||
              page === "Expenses" ||
              page === "Move Money") && (
              <AccountsPage
                page={page}
                totalPaid={totalPaid}
                outstanding={outstanding}
                expenses={expenses}
                setExpenses={setExpenses}
                transfers={transfers}
                setTransfers={setTransfers}
                transactions={transactions}
                setTransactions={setTransactions}
                jobs={jobs}
              />
            )}

            {(page === "Settings" ||
              page === "User" ||
              page === "Audit & Security") && (
              <SettingsPage page={page} theme={theme} setTheme={setTheme} />
            )}
          </div>
        </main>

        {selectedJob && (
          <JobDetailsDrawer
            job={selectedJob}
            close={() => setSelectedJob(null)}
            updateStatus={updateJobStatus}
            recordPayment={recordPayment}
          />
        )}

        {/* =====================================================
            MODALS
        ===================================================== */}

        {modal === "job" && (
          <JobModal
            close={() => setModal(null)}
            save={addJob}
          />
        )}

        {modal === "customer" && (
          <CustomerModal
            close={() => setModal(null)}
            save={addCustomer}
          />
        )}

        {modal === "material" && (
          <MaterialModal
            close={() => setModal(null)}
            save={(material) => {
              const newMaterial = { ...material, id: Date.now() };
              setMaterials((prev) => [newMaterial, ...prev]);
              if (hasSupabase) {
                supabase.from("materials").insert({ name: material.name, category: material.category, unit: material.unit, stock: material.stock, price: material.price }).then(({ error }) => {
                  if (error) { console.error(error); alert("Material saved locally, but cloud sync failed."); }
                });
              }
              auditLocal("Created material", "material", newMaterial.id, { name: material.name });
              setModal(null);
            }}
          />
        )}

        {modal === "supplier" && (
          <SupplierModal close={() => setModal(null)} save={addSupplier} />
        )}

        {modal === "staff" && (
          <StaffModal close={() => setModal(null)} save={addStaff} />
        )}
      </div>
    </>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

function Dashboard({
  totalSales,
  activeJobs,
  readyJobs,
  outstanding,
  totalPaid,
  jobs,
  navigate,
  setModal,
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            DUBAI WORKSHOP · TODAY
          </span>

          <h1>Good evening, Al Kanz.</h1>

          <p>
            Your workshop at a glance.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setModal("job")}
        >
          <Plus size={17} />
          New Repair Job
        </button>
      </div>

      <div className="hero">
        <div className="hero-text">
          <span>AL KANZ WORKSHOP</span>

          <h2>
            Run your workshop.
            <br />
            Track every payment.
          </h2>

          <p>
            Manage customers, materials, billing, expenses
            and workshop performance from one place.
          </p>

          <div className="hero-actions">
            <button onClick={() => navigate("Billing")}>
              <Receipt size={15} />
              Open billing
            </button>

            <button onClick={() => navigate("Reports")}>
              View reports
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-ring ring-one" />
          <div className="hero-ring ring-two" />

          <div className="hero-sofa">
            <Sofa size={67} />
          </div>

          <div className="floating-icon icon-a">
            <Wrench size={19} />
          </div>

          <div className="floating-icon icon-b">
            <Scissors size={19} />
          </div>

          <div className="floating-icon icon-c">
            <Banknote size={19} />
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat
          icon={Wrench}
          label="Active Jobs"
          value={activeJobs}
          note="jobs in workshop"
          color="green"
        />

        <Stat
          icon={CheckCircle2}
          label="Ready for Pickup"
          value={readyJobs}
          note="customers to notify"
          color="blue"
        />

        <Stat
          icon={CircleDollarSign}
          label="Outstanding"
          value={money(outstanding)}
          note="customer balances"
          color="orange"
        />

        <Stat
          icon={Banknote}
          label="Collected"
          value={money(totalPaid)}
          note="total payments"
          color="purple"
        />
      </div>

      <div className="two-column">
        <div className="card">
          <CardHeader
            eyebrow="WORKSHOP"
            title="Current repair jobs"
            subtitle="What's happening in your workshop"
            action="View all"
            onAction={() => navigate("Active Jobs")}
          />

          <div className="job-list">
            {jobs.slice(0, 4).map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>

        <div className="card">
          <CardHeader
            eyebrow="SHORTCUTS"
            title="Quick actions"
            subtitle="Common workshop tasks"
          />

          <div className="quick-actions">
            <QuickAction
              icon={Wrench}
              title="New Repair Job"
              subtitle="Start a workshop job"
              onClick={() => setModal("job")}
            />

            <QuickAction
              icon={Receipt}
              title="Create Invoice"
              subtitle="Generate customer billing"
            />

            <QuickAction
              icon={Users}
              title="Add Customer"
              subtitle="Create customer profile"
              onClick={() => setModal("customer")}
            />

            <QuickAction
              icon={CreditCard}
              title="Record Payment"
              subtitle="Record customer payment"
            />
          </div>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <CardHeader
            eyebrow="TODAY"
            title="Workshop schedule"
            subtitle="Jobs that need attention"
          />

          <Schedule
            time="09:30 AM"
            title="Sofa leather cutting"
            customer="Ahmed Rahman"
            tag="Cutting"
          />

          <Schedule
            time="11:00 AM"
            title="Recliner stitching"
            customer="Nabeel Ahmed"
            tag="Stitching"
          />

          <Schedule
            time="02:30 PM"
            title="Office sofa delivery"
            customer="Sameer Khan"
            tag="Delivery"
          />

          <Schedule
            time="04:00 PM"
            title="Dining chair inspection"
            customer="Faris Traders"
            tag="Inspection"
          />
        </div>

        <div className="card">
          <CardHeader
            eyebrow="FINANCE"
            title="Payment overview"
            subtitle="This month's billing"
            action="View all"
          />

          <div className="finance-number">
            <span>Collected</span>
            <strong>{money(totalPaid)}</strong>
          </div>

          <div className="large-progress">
            <span style={{ width: `${Math.min(100, totalSales ? (totalPaid / totalSales) * 100 : 0)}%` }} />
          </div>

          <div className="finance-meta">
            <span>{totalSales ? Math.round((totalPaid / totalSales) * 100) : 0}% collected</span>
            <strong>{money(outstanding)} pending</strong>
          </div>

          <div className="recent-payments">
            <Payment
              name="Ahmed Rahman"
              amount="AED 10,000"
              time="10 min ago"
            />

            <Payment
              name="Faris Traders"
              amount="AED 5,000"
              time="1 hour ago"
            />

            <Payment
              name="Sameer Khan"
              amount="AED 8,000"
              time="2 hours ago"
            />
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function Stat({
  icon: Icon,
  label,
  value,
  note,
  color,
}) {
  return (
    <div className={`stat ${color}`}>
      <div className="stat-icon">
        <Icon size={19} />
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function CardHeader({
  eyebrow,
  title,
  subtitle,
  action,
  onAction,
}) {
  return (
    <div className="card-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      {action && (
        <button
          className="text-button"
          onClick={onAction}
        >
          {action}
          <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  );
}

function JobCard({ job }) {
  const Icon =
    job.item.toLowerCase().includes("recliner")
      ? Armchair
      : job.item.toLowerCase().includes("car")
      ? Car
      : Sofa;

  const balance = job.amount - job.paid;

  return (
    <div className="job-card">
      <div className="job-product-icon">
        <Icon size={21} />
      </div>

      <div className="job-main">
        <div className="job-top">
          <strong>{job.customer}</strong>
          <Status status={job.status} />
        </div>

        <p>
          {job.item} · {job.work}
        </p>

        <div className="progress">
          <span
            style={{
              width: `${job.progress}%`,
            }}
          />
        </div>

        <small>
          {job.progress}% complete
        </small>
      </div>

      <div className="job-money">
        <strong>{money(job.amount)}</strong>
        <span>{job.id}</span>

        {balance > 0 ? (
          <small>
            Balance {money(balance)}
          </small>
        ) : (
          <small className="paid">Fully paid</small>
        )}
      </div>

      <button className="dots">
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}

function Status({ status }) {
  return (
    <span
      className={`status ${status
        .toLowerCase()
        .replaceAll(" ", "-")}`}
    >
      {status}
    </span>
  );
}

function QuickAction({
  icon: Icon,
  title,
  subtitle,
  onClick,
}) {
  return (
    <button
      className="quick-action"
      onClick={onClick}
    >
      <div className="quick-icon">
        <Icon size={18} />
      </div>

      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>

      <ArrowUpRight size={15} />
    </button>
  );
}

function Schedule({
  time,
  title,
  customer,
  tag,
}) {
  return (
    <div className="schedule">
      <span className="schedule-time">
        {time}
      </span>

      <div className="schedule-dot" />

      <div>
        <strong>{title}</strong>
        <span>{customer}</span>
      </div>

      <label>{tag}</label>
    </div>
  );
}

function Payment({
  name,
  amount,
  time,
}) {
  return (
    <div className="payment">
      <div className="payment-avatar">
        {name
          .split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2)}
      </div>

      <div>
        <strong>{name}</strong>
        <span>{time}</span>
      </div>

      <b>{amount}</b>
    </div>
  );
}

/* ============================================================
   JOBS PAGE
============================================================ */

function JobsPage({
  title,
  jobs,
  setModal,
  onViewJob,
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All status");

  const filtered = jobs.filter((job) => {
    const sectionMatch =
      title === "Active Jobs"
        ? ["Received", "Inspection", "In Progress"].includes(job.status)
        : title === "Completed Jobs"
        ? job.status === "Ready"
        : title === "Delivered"
        ? job.status === "Delivered"
        : true;

    const q = query.toLowerCase();
    const searchMatch =
      !q ||
      `${job.id} ${job.customer} ${job.phone} ${job.item} ${job.work}`
        .toLowerCase()
        .includes(q);

    const statusMatch =
      status === "All status" || job.status === status;

    return sectionMatch && searchMatch && statusMatch;
  });

  return (
    <div className="jobs-page-modern">
      <div className="jobs-page-header">
        <div>
          <div className="jobs-breadcrumb">
            Al Kanz <ChevronRight size={14} /> <strong>{title}</strong>
          </div>
          <div className="jobs-eyebrow">WORKSHOP</div>
          <h1>{title}</h1>
          <p>Manage upholstery and repair work.</p>
        </div>

        <button
          className="jobs-new-button"
          onClick={() => setModal("job")}
        >
          <Plus size={19} />
          New Repair Job
        </button>
      </div>

      <div className="jobs-toolbar-modern">
        <div className="jobs-search-modern">
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search repair jobs..."
          />
          {query && (
            <button onClick={() => setQuery("")}>×</button>
          )}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="jobs-status-filter"
        >
          <option>All status</option>
          <option>Received</option>
          <option>Inspection</option>
          <option>In Progress</option>
          <option>Ready</option>
          <option>Delivered</option>
        </select>
      </div>

      <div className="jobs-modern-card">
        <div className="jobs-modern-head">
          <span>JOB</span>
          <span>CUSTOMER</span>
          <span>ITEM / WORK</span>
          <span>STATUS</span>
          <span>AMOUNT</span>
          <span>BALANCE</span>
          <span></span>
        </div>

        {filtered.map((job) => {
          const balance = Math.max(
            0,
            Number(job.amount || 0) - Number(job.paid || 0)
          );

          return (
            <div className="jobs-modern-row" key={job.id}>
              <div className="jobs-id-cell">
                <strong>{job.id}</strong>
                <small>{job.date}</small>
              </div>

              <div className="jobs-customer-cell">
                <strong>{job.customer}</strong>
                <small>{job.phone}</small>
              </div>

              <div className="jobs-work-cell">
                <strong>{job.item}</strong>
                <small>{job.work}</small>
              </div>

              <Status status={job.status} />

              <strong className="jobs-money">
                {money(job.amount)}
              </strong>

              <strong
                className={`jobs-balance ${balance === 0 ? "paid" : ""}`}
              >
                {money(balance)}
              </strong>

              <button
                className="jobs-view-button"
                onClick={() => onViewJob(job)}
                aria-label={`View ${job.id}`}
              >
                <Eye size={19} />
              </button>
            </div>
          );
        })}

        {!filtered.length && (
          <EmptyState
            icon={ClipboardList}
            title="No jobs found"
            text="There are no jobs matching your filters."
          />
        )}

        <div className="jobs-modern-footer">
          Showing {filtered.length} of {jobs.length} jobs
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   JOB DETAILS DRAWER
============================================================ */

function JobDetailsDrawer({
  job,
  close,
  updateStatus,
  recordPayment,
}) {
  const [payment, setPayment] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  const balance = Math.max(
    0,
    Number(job.amount || 0) - Number(job.paid || 0)
  );

  const steps = [
    "Received",
    "Inspection",
    "In Progress",
    "Ready",
    "Delivered",
  ];

  const currentIndex = Math.max(
    0,
    steps.indexOf(job.status)
  );

  const submitPayment = () => {
    const amount = Number(payment);
    if (!amount || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }
    if (amount > balance) {
      alert("Payment cannot be greater than the balance.");
      return;
    }
    recordPayment(job.id, amount);
    setPayment("");
    setShowPayment(false);
  };

  return (
    <>
      <div className="job-drawer-overlay" onClick={close} />

      <aside className="job-drawer">
        <div className="job-drawer-header">
          <div>
            <span>REPAIR JOB</span>
            <h2>{job.id}</h2>
            <p>{job.date}</p>
          </div>

          <button className="job-drawer-close" onClick={close}>
            <X size={22} />
          </button>
        </div>

        <div className="job-drawer-body">
          <div className="job-detail-grid">
            <div className="job-detail-box">
              <div className="job-detail-label">
                <UserRound size={17} /> CUSTOMER
              </div>
              <strong>{job.customer}</strong>
              <p><Phone size={14} /> {job.phone}</p>
            </div>

            <div className="job-detail-box">
              <div className="job-detail-label">
                <Sofa size={17} /> ITEM
              </div>
              <strong>{job.item}</strong>
              <p>{job.work}</p>
            </div>
          </div>

          <div className="job-detail-grid">
            <div className="job-detail-box">
              <div className="job-detail-label">
                <Package size={17} /> MATERIAL
              </div>
              <strong>{job.material || "Not specified"}</strong>
              <p>{job.colour || "Colour not specified"}</p>
              <small>Quantity: {job.quantity || 1}</small>
            </div>

            <div className="job-detail-box">
              <div className="job-detail-label">
                <CalendarDays size={17} /> DELIVERY
              </div>
              <strong>
                {job.deliveryDate || "Not scheduled"}
              </strong>
              <p>Expected delivery</p>
            </div>
          </div>

          <section className="job-detail-section">
            <div className="job-section-title">
              <FileText size={18} /> BILLING BREAKDOWN
            </div>

            <div className="job-money-row">
              <span>Material Cost</span>
              <strong>{money(job.materialCost || 0)}</strong>
            </div>
            <div className="job-money-row">
              <span>Labour Charge</span>
              <strong>{money(job.labour || 0)}</strong>
            </div>
            <div className="job-money-row">
              <span>Other Charges</span>
              <strong>{money(job.otherCharges || 0)}</strong>
            </div>
            <div className="job-money-row discount">
              <span>Discount</span>
              <strong>-{money(job.discount || 0)}</strong>
            </div>

            <div className="job-total-row">
              <span>TOTAL</span>
              <strong>{money(job.amount || 0)}</strong>
            </div>
          </section>

          <section className="job-detail-section">
            <div className="job-section-title">
              <CircleDollarSign size={18} /> PAYMENT
            </div>

            <div className="job-money-row">
              <span>Paid</span>
              <strong className="job-paid">
                {money(job.paid || 0)}
              </strong>
            </div>

            <div className="job-balance-row">
              <span>BALANCE DUE</span>
              <strong>{money(balance)}</strong>
            </div>

            {!showPayment ? (
              <button
                className="job-payment-button"
                onClick={() => setShowPayment(true)}
                disabled={balance === 0}
              >
                <CreditCard size={17} />
                {balance === 0 ? "Fully Paid" : "Record Payment"}
              </button>
            ) : (
              <div className="job-payment-form">
                <label>Payment amount</label>
                <div className="job-payment-input">
                  <span>AED </span>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    max={balance}
                    value={payment}
                    onChange={(e) => setPayment(e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
                <div className="job-payment-actions">
                  <button onClick={() => setShowPayment(false)}>
                    Cancel
                  </button>
                  <button onClick={submitPayment}>
                    Save Payment
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="job-detail-section">
            <div className="job-section-title">
              <ClipboardList size={18} /> JOB STATUS
            </div>

            <div className="job-status-timeline">
              {steps.map((step, index) => {
                const active = index <= currentIndex;
                return (
                  <div
                    className={`job-status-step ${active ? "active" : ""} ${
                      step === job.status ? "current" : ""
                    }`}
                    key={step}
                  >
                    <div className="job-status-dot">
                      {active && <CheckCircle2 size={13} />}
                    </div>
                    <span>{step}</span>
                  </div>
                );
              })}
            </div>

            <label className="job-status-label">
              Change status
              <select
                value={job.status}
                onChange={(e) =>
                  updateStatus(job.id, e.target.value)
                }
              >
                {steps.map((step) => (
                  <option key={step}>{step}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="job-detail-section">
            <div className="job-section-title">
              ACTIONS
            </div>

            <div className="job-action-grid">
              <button
                onClick={() =>
                  alert(
                    `Invoice for ${job.id}\nTotal: ${money(job.amount)}\nBalance: ${money(balance)}`
                  )
                }
              >
                <FileText size={17} />
                Create Invoice
              </button>

              <button
                onClick={() =>
                  alert(
                    `Job ${job.id} is currently ${job.status}.`
                  )
                }
              >
                <CheckCircle2 size={17} />
                Job Summary
              </button>
            </div>
          </section>

          <section className="job-detail-section">
            <div className="job-section-title">
              NOTES
            </div>
            <p className="job-notes">
              {job.notes || "No notes added for this job."}
            </p>
          </section>
        </div>
      </aside>
    </>
  );
}

/* ============================================================
   CUSTOMERS
============================================================ */

function CustomersPage({
  customers,
  setModal,
}) {
  return (
    <>
      <PageTitle
        eyebrow="WORKSHOP"
        title="Customers"
        subtitle="Manage customer profiles and outstanding balances."
        button="Add Customer"
        onClick={() => setModal("customer")}
      />

      <div className="customer-grid">
        {customers.map((customer) => (
          <div className="customer-card" key={customer.id}>
            <div className="customer-top">
              <div className="customer-avatar">
                {customer.name
                  .split(" ")
                  .map((x) => x[0])
                  .join("")
                  .slice(0, 2)}
              </div>

              <button className="dots">
                <MoreHorizontal size={17} />
              </button>
            </div>

            <h3>{customer.name}</h3>

            <div className="customer-detail">
              <Phone size={14} />
              {customer.phone}
            </div>

            <div className="customer-detail">
              <MapPin size={14} />
              {customer.location}
            </div>

            <div className="customer-stats">
              <div>
                <span>Jobs</span>
                <strong>{customer.jobs}</strong>
              </div>

              <div>
                <span>Outstanding</span>
                <strong>
                  {money(customer.outstanding)}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   MATERIALS
============================================================ */

function MaterialsPage({
  materials,
  setMaterials,
  setModal,
}) {
  return (
    <>
      <PageTitle
        eyebrow="WORKSHOP"
        title="Materials"
        subtitle="Track leather, fabric, foam and workshop materials."
        button="Add Material"
        onClick={() => setModal("material")}
      />

      <div className="material-grid">
        {materials.map((material) => (
          <div className="material-card" key={material.id}>
            <div className="material-icon">
              <Layers3 size={20} />
            </div>

            <div className="material-info">
              <span>{material.category}</span>
              <h3>{material.name}</h3>
              <p>
                AED {material.price} / {material.unit}
              </p>
            </div>

            <div
              className={`stock ${
                material.stock < 20
                  ? "low-stock"
                  : ""
              }`}
            >
              <strong>{material.stock}</strong>
              <span>{material.unit}s</span>
            </div>

            <button
              className="delete-small"
              onClick={() =>
                setMaterials((prev) =>
                  prev.filter(
                    (x) => x.id !== material.id
                  )
                )
              }
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   SUPPLIERS
============================================================ */

function SuppliersPage({ suppliers, setSuppliers, setModal }) {
  return (
    <>
      <PageTitle
        eyebrow="WORKSHOP"
        title="Suppliers"
        subtitle="Manage material suppliers and balances."
        button="Add Supplier"
        onClick={() => setModal("supplier")}
      />

      <div className="table-card">
        <div className="table-head supplier-head">
          <span>SUPPLIER</span>
          <span>PHONE</span>
          <span>MATERIAL</span>
          <span>BALANCE</span>
          <span />
        </div>

        {suppliers.map((supplier) => (
          <div className="table-row supplier-row" key={supplier.id}>
            <div>
              <strong>{supplier.name}</strong>
              <small>Supplier #{supplier.id}</small>
            </div>
            <span>{supplier.phone}</span>
            <span>{supplier.material}</span>
            <strong>{money(supplier.balance)}</strong>
            <button className="row-action" type="button">
              <Eye size={16} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   STAFF
============================================================ */

function StaffPage({ staff, setStaff, setModal }) {
  return (
    <>
      <PageTitle
        eyebrow="TEAM"
        title="Staff"
        subtitle="Manage workshop employees and responsibilities."
        button="Add Staff"
        onClick={() => setModal("staff")}
      />

      <div className="staff-grid">
        {staff.map((person) => (
          <div className="staff-card" key={person.id}>
            <div className="staff-avatar">
              {person.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
            </div>
            <h3>{person.name}</h3>
            <p>{person.role}</p>
            <span>{person.phone}</span>
            <label className={person.status === "Active" ? "staff-active" : "staff-leave"}>
              {person.status}
            </label>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   BILLING
============================================================ */

function BillingPage({ page, jobs, payments = [], outstanding, totalPaid, recordPayment }) {
  const invoices = jobs.map((job) => ({
    id: `INV-${String(job.id).replace("AK-", "")}`,
    customer: job.customer,
    jobId: job.id,
    item: job.item,
    amount: Number(job.amount || 0),
    paid: Number(job.paid || 0),
    balance: Math.max(0, Number(job.amount || 0) - Number(job.paid || 0)),
    status: Number(job.amount || 0) <= Number(job.paid || 0) ? "Paid" : Number(job.paid || 0) > 0 ? "Part Paid" : "Unpaid",
  }));
  const [selected, setSelected] = useState(null);
  const [payment, setPayment] = useState("");
  const [billPrinting, setBillPrinting] = useState(false);
  const [billRun, setBillRun] = useState(0);
  const collectedPercent = invoices.reduce((a, b) => a + b.amount, 0) > 0
    ? Math.min(100, (totalPaid / invoices.reduce((a, b) => a + b.amount, 0)) * 100)
    : 0;

  const startBillPrint = () => {
    setBillPrinting(false);
    setBillRun((n) => n + 1);
    requestAnimationFrame(() => setBillPrinting(true));
    window.setTimeout(() => setBillPrinting(false), 4200);
  };

  return (
    <>
      <PageTitle eyebrow="BILLING · UAE" title={page === "Billing" ? "Billing" : page} subtitle="Invoices, payments and customer billing in AED." />

      {page === "Billing" && (
        <div className={`billing-machine ${billPrinting ? "is-printing" : ""}`} key={billRun}>
          <div className="billing-machine-screen">
            <div className="machine-topline"><span>AL KANZ BILLING TERMINAL</span><b><i /> ONLINE</b></div>
            <div className="machine-main">
              <div className="bill-create-panel">
                <small>CREATE BILL</small>
                <strong>{money(totalPaid)}</strong>
                <span>{invoices.length} invoices · {money(outstanding)} outstanding</span>
                <button type="button" className="create-bill-button" onClick={startBillPrint}>
                  <ReceiptText size={15} /> Create & Print Bill
                </button>
              </div>
              <div className="machine-ring" style={{ "--billing-progress": `${collectedPercent}%` }}>
                <div><b>{Math.round(collectedPercent)}%</b><span>collected</span></div>
              </div>
            </div>
            <div className="billing-transfer-animation" aria-hidden="true">
              <div className="bill-source"><div className="bill-paper-icon"><FileText size={18} /></div><span>BILL</span></div>
              <div className="wave-track">
                {["B","I","L","L","I","N","G"].map((letter, index) => (
                  <span key={`${letter}-${index}`} style={{ "--wave-delay": `${index * 0.12}s` }}>{letter}</span>
                ))}
              </div>
              <div className="printer-icon"><Printer size={25} /><i /></div>
            </div>
            <div className="machine-scanline" />
          </div>
          <div className="billing-machine-receipt">
            <div className="receipt-printer">
              <div className="printer-top"><span className="printer-light" /><span>AL KANZ PRINTER</span></div>
              <div className="printer-slot">
                <div className="printed-paper">
                  <strong>AL KANZ</strong><span>UPHOLSTERY BILL</span><i />
                  <small>Customer invoice · AED</small><b>{money(totalPaid)}</b>
                </div>
              </div>
            </div>
            <span className="receipt-caption">PAYMENT RECEIPT</span>
            <strong>{billPrinting ? "Printing your bill..." : "Ready for billing"}</strong>
            <div className="receipt-line"><i /> <i /> <i /></div>
            <small>Bill data travels to the printer as an animated wave, then the receipt rolls out.</small>
          </div>
          <div className="machine-status"><span /> {billPrinting ? "Printing bill" : "Payment system ready"} <b>· AED</b></div>
        </div>
      )}

      <div className="billing-stats">
        <Stat icon={FileText} label="Invoices" value={invoices.length} note="workshop invoices" color="blue" />
        <Stat icon={CircleDollarSign} label="Billed" value={money(invoices.reduce((a,b)=>a+b.amount,0))} note="total invoiced" color="green" />
        <Stat icon={CreditCard} label="Collected" value={money(totalPaid)} note="customer payments" color="purple" />
        <Stat icon={AlertCircle} label="Outstanding" value={money(outstanding)} note="pending collection" color="orange" />
      </div>

      {page === "Transactions" ? (
        <div className="table-card">
          <div className="table-head"><span>DATE</span><span>DESCRIPTION</span><span>TYPE</span><span>ACCOUNT</span><span>AMOUNT</span></div>
          {payments.length ? payments.map((pay, i) => (
            <div className="table-row" key={pay.id || i}>
              <span>{pay.paid_at ? new Date(pay.paid_at).toLocaleDateString("en-AE") : "—"}</span>
              <strong>{pay.notes || `Payment · ${pay.customer || "Customer"}`}</strong>
              <Status status="Income" />
              <span>{pay.payment_method || "Cash"}</span>
              <strong className="income">+{money(pay.amount)}</strong>
            </div>
          )) : <EmptyState icon={ReceiptText} title="No transactions yet" text="Customer payments will appear here." />}
        </div>
      ) : page !== "Payments" ? (
        <div className="table-card">
          <div className="table-head invoice-head"><span>INVOICE</span><span>CUSTOMER</span><span>JOB / ITEM</span><span>AMOUNT</span><span>PAID</span><span>BALANCE</span><span>STATUS</span><span /></div>
          {invoices.map((invoice) => (
            <div className="table-row" key={invoice.id}>
              <strong>{invoice.id}</strong>
              <strong>{invoice.customer}</strong>
              <div><strong>{invoice.jobId}</strong><small>{invoice.item}</small></div>
              <strong>{money(invoice.amount)}</strong>
              <strong>{money(invoice.paid)}</strong>
              <strong>{money(invoice.balance)}</strong>
              <Status status={invoice.status} />
              <button className="row-action" onClick={() => setSelected(invoice)}><Eye size={16} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-card">
          <div className="table-head"><span>DATE</span><span>DESCRIPTION</span><span>METHOD</span><span>AMOUNT</span><span>REFERENCE</span></div>
          {payments.length ? payments.map((pay, i) => (
            <div className="table-row" key={pay.id || i}>
              <span>{pay.paid_at ? new Date(pay.paid_at).toLocaleDateString("en-AE") : "—"}</span>
              <strong>{pay.customer || pay.notes || "Customer Payment"}</strong>
              <span>{pay.payment_method || "Cash"}</span>
              <strong className="income">+{money(pay.amount)}</strong>
              <span>{pay.reference || "—"}</span>
            </div>
          )) : <EmptyState icon={CreditCard} title="No payments yet" text="Payments recorded against jobs will appear here." />}
        </div>
      )}

      {selected && (
        <div className="modal-backdrop">
          <div className="card" style={{width:"min(620px,94vw)",padding:"28px",position:"relative"}}>
            <button className="job-drawer-close" style={{position:"absolute",right:18,top:18}} onClick={()=>setSelected(null)}><X size={20}/></button>
            <span className="eyebrow">UAE INVOICE</span>
            <h2 style={{margin:"8px 0 4px"}}>{selected.id}</h2>
            <p style={{marginTop:0,color:"#718078"}}>Al Kanz Upholstery · Dubai</p>
            <div className="table-card" style={{marginTop:20}}>
              <div className="table-row"><span>Customer</span><strong>{selected.customer}</strong></div>
              <div className="table-row"><span>Job</span><strong>{selected.jobId}</strong></div>
              <div className="table-row"><span>Item</span><strong>{selected.item}</strong></div>
              <div className="table-row"><span>Total</span><strong>{money(selected.amount)}</strong></div>
              <div className="table-row"><span>Paid</span><strong>{money(selected.paid)}</strong></div>
              <div className="table-row"><span>Balance</span><strong>{money(selected.balance)}</strong></div>
            </div>
            {selected.balance > 0 && recordPayment && (
              <div style={{marginTop:20}}>
                <label className="field"><span>Record payment</span><input type="number" min="0" max={selected.balance} value={payment} onChange={e=>setPayment(e.target.value)} placeholder="AED 0.00" /></label>
                <button className="primary-button" style={{marginTop:12}} onClick={()=>{ recordPayment(selected.jobId, payment); setPayment(""); setSelected(null); }}><CreditCard size={16}/> Save Payment</button>
              </div>
            )}
            <button className="secondary-button" style={{marginTop:12}} onClick={()=>window.print()}><Printer size={16}/> Print Invoice</button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   REPORTS
============================================================ */

function ReportsPage({
  jobs,
  totalPaid,
  outstanding,
  totalExpenses = 0,
  netCash = 0,
  expenses = [],
}) {
  const total = jobs.reduce((a, b) => a + Number(b.amount || 0), 0);

  const monthlyRevenue = Array.from({ length: 12 }, (_, month) => ({
    month: new Date(2026, month, 1).toLocaleString("en", { month: "short" }),
    revenue: jobs.reduce((sum, job) => {
      const raw = job.date || "";
      const d = new Date(raw);
      return !Number.isNaN(d.getTime()) && d.getMonth() === month
        ? sum + Number(job.amount || 0)
        : sum;
    }, 0),
  }));

  const dailyExpenses = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - index));
    const key = d.toISOString().slice(0, 10);
    return {
      day: d.toLocaleDateString("en-AE", { weekday: "short", day: "2-digit" }),
      amount: expenses.reduce((sum, expense) => {
        const expenseKey = String(expense.expense_date || expense.date || "").slice(0, 10);
        return expenseKey === key ? sum + Number(expense.amount || 0) : sum;
      }, 0),
    };
  });

  return (
    <>
      <PageTitle
        eyebrow="FINANCE"
        title="Reports"
        subtitle="Understand workshop performance, revenue and daily expenses."
      />

      <div className="report-grid">
        <ReportBox icon={TrendingUp} title="Total Revenue" value={money(total)} note="Total value of workshop jobs" />
        <ReportBox icon={CircleDollarSign} title="Payments Collected" value={money(totalPaid)} note="Customer payments received" />
        <ReportBox icon={AlertCircle} title="Outstanding" value={money(outstanding)} note="Still to be collected" />
        <ReportBox icon={Wallet} title="Expenses" value={money(totalExpenses)} note="Workshop costs recorded" />
        <ReportBox icon={TrendingUp} title="Net Cash Movement" value={money(netCash)} note="Payments less expenses" />
        <ReportBox icon={CheckCircle2} title="Jobs Completed" value={jobs.filter(j => j.status === "Ready" || j.status === "Delivered").length} note="Ready or delivered jobs" />
      </div>

      <div className="reports-chart-grid">
        <div className="card report-chart">
          <CardHeader eyebrow="REVENUE" title="Monthly workshop performance" subtitle="Revenue by month from recorded jobs" />
          <div className="bars live-bars">
            {monthlyRevenue.map((item) => {
              const max = Math.max(...monthlyRevenue.map(x => x.revenue), 1);
              const height = item.revenue ? Math.max(8, (item.revenue / max) * 100) : 4;
              return (
                <div className="bar-wrap" key={item.month}>
                  <div className="bar animated-bar" style={{ height: `${height}%` }} title={money(item.revenue)} />
                  <span>{item.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card report-chart daily-expense-card">
          <CardHeader eyebrow="EXPENSES" title="Daily expense" subtitle="Last 7 days of recorded expenses" />
          <div className="expense-bars">
            {dailyExpenses.map((item) => {
              const max = Math.max(...dailyExpenses.map(x => x.amount), 1);
              const height = item.amount ? Math.max(8, (item.amount / max) * 100) : 4;
              return (
                <div className="expense-bar-wrap" key={item.day}>
                  <span className="expense-value">{money(item.amount)}</span>
                  <div className="expense-bar" style={{ height: `${height}%` }} title={money(item.amount)} />
                  <span className="expense-day">{item.day}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function ReportBox({
  icon: Icon,
  title,
  value,
  note,
}) {
  return (
    <div className="report-box">
      <div>
        <Icon size={20} />
      </div>

      <span>{title}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

/* ============================================================
   ACCOUNTS
============================================================ */

function AccountsPage({ page, totalPaid, outstanding, expenses = [], setExpenses, transfers = [], setTransfers, transactions = [], setTransactions, jobs = [] }) {
  const [expenseForm, setExpenseForm] = useState({category:"Workshop",description:"",amount:"",account:"Cash",reference:""});
  const [transferForm, setTransferForm] = useState({from_account:"Cash",to_account:"Bank",amount:"",reference:""});

  const addExpense = async (e) => {
    e.preventDefault();
    const amount = Number(expenseForm.amount);
    if (!expenseForm.description || !amount) return;
    const row = { id: Date.now().toString(), ...expenseForm, amount, expense_date: new Date().toISOString().slice(0,10) };
    setExpenses(prev=>[row,...prev]);
    setTransactions(prev=>[{id:Date.now().toString()+"t",transaction_type:"Expense",description:expenseForm.description,amount,account:expenseForm.account,transaction_date:new Date().toISOString()},...prev]);
    if (hasSupabase) {
      const saved=await supabase.from("expenses").insert({category:expenseForm.category,description:expenseForm.description,amount,account:expenseForm.account,reference:expenseForm.reference,expense_date:row.expense_date}).select("*").single();
      if(saved.error) alert("Expense saved locally, but cloud sync failed.");
      else await supabase.from("transactions").insert({transaction_type:"Expense",description:expenseForm.description,amount,account:expenseForm.account,expense_id:saved.data.id});
    }
    auditLocal("Created expense","expense",row.id,row);
    setExpenseForm({category:"Workshop",description:"",amount:"",account:"Cash",reference:""});
  };

  const addTransfer = async (e) => {
    e.preventDefault();
    const amount=Number(transferForm.amount);
    if(!amount || transferForm.from_account===transferForm.to_account) return;
    const row={id:Date.now().toString(),...transferForm,amount,transfer_date:new Date().toISOString().slice(0,10)};
    setTransfers(prev=>[row,...prev]);
    if(hasSupabase){
      const saved=await supabase.from("money_transfers").insert({from_account:row.from_account,to_account:row.to_account,amount,reference:row.reference,transfer_date:row.transfer_date}).select("*").single();
      if(saved.error) alert("Transfer saved locally, but cloud sync failed.");
      else await supabase.from("transactions").insert({transaction_type:"Transfer",description:`Transfer ${row.from_account} → ${row.to_account}`,amount,account:row.to_account,transfer_id:saved.data.id});
    }
    auditLocal("Moved money","transfer",row.id,row);
    setTransferForm({from_account:"Cash",to_account:"Bank",amount:"",reference:""});
  };

  const totalExpenses=expenses.reduce((a,b)=>a+Number(b.amount||0),0);
  const net=totalPaid-totalExpenses;

  return (
    <>
      <PageTitle eyebrow="FINANCE · UAE" title={page} subtitle="Manage workshop income, expenses and money movement in AED." />
      <div className="account-tabs">
        {['Accounts','Ledger','Expenses','Move Money'].map(x=><button key={x} className={page===x?'active':''}>{x}</button>)}
      </div>
      <div className="account-overview">
        <div className="account-big-card"><span>Customer Receivables</span><strong>{money(outstanding)}</strong><small>Outstanding invoices</small></div>
        <div className="account-big-card"><span>Payments Received</span><strong>{money(totalPaid)}</strong><small>Customer collections</small></div>
        <div className="account-big-card"><span>Expenses</span><strong>{money(totalExpenses)}</strong><small>Workshop expenses</small></div>
        <div className="account-big-card"><span>Net Cash Movement</span><strong>{money(net)}</strong><small>Income minus expenses</small></div>
      </div>

      {page === 'Expenses' && <div className="card" style={{padding:24,marginBottom:18}}>
        <CardHeader eyebrow="EXPENSES" title="Add workshop expense" subtitle="Record leather, labour, rent, transport or other business costs." />
        <form onSubmit={addExpense} className="modal-grid">
          <Field label="Description" value={expenseForm.description} onChange={v=>setExpenseForm({...expenseForm,description:v})} placeholder="Leather purchase"/>
          <Field label="Amount" type="number" value={expenseForm.amount} onChange={v=>setExpenseForm({...expenseForm,amount:v})} placeholder="AED 0.00"/>
          <SelectField label="Category" value={expenseForm.category} onChange={v=>setExpenseForm({...expenseForm,category:v})} options={['Workshop','Materials','Transport','Rent','Utilities','Salary','Other']}/>
          <SelectField label="Account" value={expenseForm.account} onChange={v=>setExpenseForm({...expenseForm,account:v})} options={['Cash','Bank','Card']}/>
          <button className="primary-button" type="submit"><Plus size={16}/> Add Expense</button>
        </form>
        <div className="table-card" style={{marginTop:20}}><div className="table-head"><span>DATE</span><span>DESCRIPTION</span><span>CATEGORY</span><span>ACCOUNT</span><span>AMOUNT</span></div>{expenses.map(x=><div className="table-row" key={x.id}><span>{x.expense_date}</span><strong>{x.description}</strong><span>{x.category}</span><span>{x.account}</span><strong className="expense">-{money(x.amount)}</strong></div>)}</div>
      </div>}

      {page === 'Move Money' && <div className="card" style={{padding:24,marginBottom:18}}>
        <CardHeader eyebrow="MOVE MONEY" title="Transfer between accounts" subtitle="Move funds between Cash, Bank and Card accounts." />
        <form onSubmit={addTransfer} className="modal-grid">
          <SelectField label="From" value={transferForm.from_account} onChange={v=>setTransferForm({...transferForm,from_account:v})} options={['Cash','Bank','Card']}/>
          <SelectField label="To" value={transferForm.to_account} onChange={v=>setTransferForm({...transferForm,to_account:v})} options={['Cash','Bank','Card']}/>
          <Field label="Amount" type="number" value={transferForm.amount} onChange={v=>setTransferForm({...transferForm,amount:v})} placeholder="AED 0.00"/>
          <button className="primary-button" type="submit"><ArrowLeftRight size={16}/> Transfer</button>
        </form>
        <div className="table-card" style={{marginTop:20}}><div className="table-head"><span>DATE</span><span>FROM</span><span>TO</span><span>REFERENCE</span><span>AMOUNT</span></div>{transfers.map(x=><div className="table-row" key={x.id}><span>{x.transfer_date}</span><strong>{x.from_account}</strong><strong>{x.to_account}</strong><span>{x.reference||'—'}</span><strong>{money(x.amount)}</strong></div>)}</div>
      </div>}

      {page === 'Ledger' && <div className="table-card"><div className="table-head"><span>DATE</span><span>DESCRIPTION</span><span>TYPE</span><span>ACCOUNT</span><span>AMOUNT</span></div>{transactions.map(x=><div className="table-row" key={x.id}><span>{x.transaction_date ? new Date(x.transaction_date).toLocaleDateString('en-AE') : '—'}</span><strong>{x.description}</strong><Status status={x.transaction_type}/><span>{x.account}</span><strong className={x.transaction_type==='Expense'?'expense':'income'}>{x.transaction_type==='Expense'?'-':'+'}{money(x.amount)}</strong></div>)}</div>}

      {page === 'Accounts' && <div className="table-card"><div className="table-head"><span>DATE</span><span>DESCRIPTION</span><span>TYPE</span><span>ACCOUNT</span><span>AMOUNT</span></div>{transactions.slice(0,12).map(x=><div className="table-row" key={x.id}><span>{x.transaction_date ? new Date(x.transaction_date).toLocaleDateString('en-AE') : '—'}</span><strong>{x.description}</strong><Status status={x.transaction_type}/><span>{x.account}</span><strong className={x.transaction_type==='Expense'?'expense':'income'}>{x.transaction_type==='Expense'?'-':'+'}{money(x.amount)}</strong></div>)}</div>}
    </>
  );
}

/* ============================================================
   SETTINGS
============================================================ */

function SettingsPage({ page, theme, setTheme }) {
  return (
    <>
      <PageTitle
        eyebrow="SYSTEM"
        title={page}
        subtitle="Manage your workshop account and security."
      />

      <div className="settings-layout">
        <div className="settings-menu">
          <button className="active">
            <UserCog size={17} />
            User Profile
          </button>
          <button>
            <Settings size={17} />
            Workshop Settings
          </button>
          <button>
            <Bell size={17} />
            Notifications
          </button>
          <button>
            <ShieldCheck size={17} />
            Security
          </button>
          <button>
            <Lock size={17} />
            Password
          </button>
        </div>

        <div className="card settings-card">
          <CardHeader
            eyebrow="PROFILE"
            title="User information"
            subtitle="Update your account details."
          />
          <div className="settings-form">
            <label>
              Full name
              <input value="Al Kanz Admin" readOnly />
            </label>
            <label>
              Email
              <input value="admin@alkanzupholstery.com" readOnly />
            </label>
            <label>
              Phone
              <input value="+971 50 000 0000" readOnly />
            </label>
            <label>
              Role
              <input value="Owner" readOnly />
            </label>
            <button className="primary-button">
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>

        <div className="card appearance-card">
          <CardHeader
            eyebrow="APPEARANCE"
            title="Choose your theme"
            subtitle="Switch between the default, light, and dark workspace."
          />
          <div className="theme-options">
            <button
              className={`theme-option ${theme === "default" ? "active" : ""}`}
              onClick={() => setTheme("default")}
            >
              <span className="theme-preview theme-preview-default" />
              <div><strong>Default</strong><small>Al Kanz green</small></div>
              {theme === "default" && <CheckCircle2 size={17} />}
            </button>
            <button
              className={`theme-option ${theme === "light" ? "active" : ""}`}
              onClick={() => setTheme("light")}
            >
              <span className="theme-preview theme-preview-light" />
              <div><strong>Light</strong><small>Bright workspace</small></div>
              {theme === "light" && <CheckCircle2 size={17} />}
            </button>
            <button
              className={`theme-option ${theme === "dark" ? "active" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <span className="theme-preview theme-preview-dark" />
              <div><strong>Dark</strong><small>Easy on the eyes</small></div>
              {theme === "dark" && <CheckCircle2 size={17} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   PAGE TITLE
============================================================ */

function PageTitle({
  eyebrow,
  title,
  subtitle,
  button,
  onClick,
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {button && (
        <button
          className="primary-button"
          onClick={onClick}
        >
          <Plus size={17} />
          {button}
        </button>
      )}
    </div>
  );
}

/* ============================================================
   EMPTY
============================================================ */

function EmptyState({
  icon: Icon,
  title,
  text,
}) {
  return (
    <div className="empty">
      <Icon size={30} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

/* ============================================================
   JOB MODAL
============================================================ */

function JobModal({ close, save }) {
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    item: "3-Seater Sofa",
    description: "",
    work: "Full Leather Replacement",
    material: "Premium Leather",
    colour: "",
    quantity: "1",
    materialCost: "",
    labour: "",
    otherCharges: "",
    discount: "",
    paid: "",
    deliveryDate: "",
    notes: "",
  });

  const update = (key, value) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const materialCost = Number(form.materialCost || 0);
  const labour = Number(form.labour || 0);
  const otherCharges = Number(form.otherCharges || 0);
  const discount = Number(form.discount || 0);
  const paid = Number(form.paid || 0);

  const total = Math.max(
    materialCost + labour + otherCharges - discount,
    0
  );

  const balance = Math.max(total - paid, 0);

  const submit = (e) => {
    e.preventDefault();

    if (!form.customer.trim()) {
      alert("Please enter customer name.");
      return;
    }

    if (!form.phone.trim()) {
      alert("Please enter phone number.");
      return;
    }

    if (total <= 0) {
      alert("Please enter at least one charge.");
      return;
    }

    if (paid > total) {
      alert("Advance cannot be greater than total.");
      return;
    }

    save({
      ...form,
      customer: form.customer.trim(),
      phone: form.phone.trim(),
      quantity: Number(form.quantity || 1),
      materialCost,
      labour,
      otherCharges,
      discount,
      amount: total,
      paid,
      balance,
    });
  };

  return (
    <Modal
      title="New Repair Job"
      subtitle="Create a complete upholstery repair job."
      close={close}
    >
      <form onSubmit={submit} className="new-job-form">
        <div className="job-form-section-title">
          <span>CUSTOMER</span>
          <p>Customer information</p>
        </div>

        <div className="modal-grid">
          <Field
            label="Customer name"
            value={form.customer}
            onChange={(v) => update("customer", v)}
            placeholder="Enter customer name"
          />
          <Field
            label="Phone number"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            placeholder="+971 5X XXX XXXX"
          />
        </div>

        <div className="job-form-section-title">
          <span>ITEM & REPAIR</span>
          <p>What is being repaired or re-upholstered?</p>
        </div>

        <div className="modal-grid">
          <SelectField
            label="Item"
            value={form.item}
            onChange={(v) => update("item", v)}
            options={[
              "3-Seater Sofa",
              "2-Seater Sofa",
              "L-Shape Sofa",
              "Recliner",
              "Dining Chairs",
              "Office Chair",
              "Office Sofa",
              "Car Seat",
              "Headboard",
              "Ottoman",
              "Other",
            ]}
          />

          <Field
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(v) => update("quantity", v)}
            placeholder="1"
          />

          <SelectField
            label="Repair / Work"
            value={form.work}
            onChange={(v) => update("work", v)}
            options={[
              "Full Leather Replacement",
              "Leather Repair",
              "Fabric Replacement",
              "Re-Upholstery",
              "Foam Replacement",
              "Repair & Stitching",
              "Frame Repair",
              "Polishing",
              "Multiple Repairs",
              "Other",
            ]}
          />

          <Field
            label="Item description"
            value={form.description}
            onChange={(v) => update("description", v)}
            placeholder="Describe the item or damage"
          />
        </div>

        <div className="job-form-section-title">
          <span>MATERIAL</span>
          <p>Material used for the repair</p>
        </div>

        <div className="modal-grid">
          <Field
            label="Material"
            value={form.material}
            onChange={(v) => update("material", v)}
            placeholder="Leather / Fabric / Foam"
          />
          <Field
            label="Colour"
            value={form.colour}
            onChange={(v) => update("colour", v)}
            placeholder="Black / Brown / Beige"
          />
          <Field
            label="Material cost"
            type="number"
            value={form.materialCost}
            onChange={(v) => update("materialCost", v)}
            placeholder="AED  0"
          />
        </div>

        <div className="job-form-section-title">
          <span>CHARGES</span>
          <p>Build the customer bill</p>
        </div>

        <div className="modal-grid">
          <Field
            label="Labour charge"
            type="number"
            value={form.labour}
            onChange={(v) => update("labour", v)}
            placeholder="AED  0"
          />
          <Field
            label="Other charges"
            type="number"
            value={form.otherCharges}
            onChange={(v) => update("otherCharges", v)}
            placeholder="AED  0"
          />
          <Field
            label="Discount"
            type="number"
            value={form.discount}
            onChange={(v) => update("discount", v)}
            placeholder="AED  0"
          />
        </div>

        <div className="job-form-summary">
          <div><span>Material</span><strong>{money(materialCost)}</strong></div>
          <div><span>Labour</span><strong>{money(labour)}</strong></div>
          <div><span>Other</span><strong>{money(otherCharges)}</strong></div>
          <div className="discount"><span>Discount</span><strong>-{money(discount)}</strong></div>
          <div className="summary-total"><span>TOTAL</span><strong>{money(total)}</strong></div>
        </div>

        <div className="job-form-section-title">
          <span>PAYMENT & DELIVERY</span>
          <p>Record advance and expected delivery</p>
        </div>

        <div className="modal-grid">
          <Field
            label="Advance paid"
            type="number"
            value={form.paid}
            onChange={(v) => update("paid", v)}
            placeholder="AED  0"
          />
          <Field
            label="Expected delivery"
            type="date"
            value={form.deliveryDate}
            onChange={(v) => update("deliveryDate", v)}
          />
        </div>

        <div className={`job-form-balance ${balance === 0 ? "clear" : ""}`}>
          <span>BALANCE DUE</span>
          <strong>{money(balance)}</strong>
        </div>

        <div className="job-form-notes">
          <label>Job notes</label>
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Special instructions, damage details or customer requirements..."
          />
        </div>

        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            <Save size={16} />
            Create Repair Job
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   CUSTOMER MODAL
============================================================ */

function CustomerModal({ close, save }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] =
    useState("");

  return (
    <Modal
      title="Add Customer"
      subtitle="Create a customer profile."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();

          if (!name) return;

          save({
            name,
            phone,
            location,
          });
        }}
      >
        <div className="modal-grid">
          <Field
            label="Customer name"
            value={name}
            onChange={setName}
            placeholder="Full name"
          />

          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+971 5X XXX XXXX"
          />

          <Field
            label="Location"
            value={location}
            onChange={setLocation}
            placeholder="City / Area"
          />
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={close}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            type="submit"
          >
            <Save size={16} />
            Save Customer
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   MATERIAL MODAL
============================================================ */

function MaterialModal({ close, save }) {
  const [form, setForm] = useState({
    name: "",
    category: "Leather",
    unit: "Meter",
    stock: "",
    price: "",
  });

  return (
    <Modal
      title="Add Material"
      subtitle="Add leather, fabric, foam or another workshop material."
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();

          save({
            ...form,
            stock: Number(form.stock || 0),
            price: Number(form.price || 0),
          });
        }}
      >
        <div className="modal-grid">
          <Field
            label="Material name"
            value={form.name}
            onChange={(v) =>
              setForm({
                ...form,
                name: v,
              })
            }
            placeholder="Premium Black Leather"
          />

          <SelectField
            label="Category"
            value={form.category}
            onChange={(v) =>
              setForm({
                ...form,
                category: v,
              })
            }
            options={[
              "Leather",
              "Fabric",
              "Foam",
              "Accessories",
              "Other",
            ]}
          />

          <SelectField
            label="Unit"
            value={form.unit}
            onChange={(v) =>
              setForm({
                ...form,
                unit: v,
              })
            }
            options={[
              "Meter",
              "Sheet",
              "Piece",
              "Roll",
            ]}
          />

          <Field
            label="Current stock"
            type="number"
            value={form.stock}
            onChange={(v) =>
              setForm({
                ...form,
                stock: v,
              })
            }
            placeholder="0"
          />

          <Field
            label="Price"
            type="number"
            value={form.price}
            onChange={(v) =>
              setForm({
                ...form,
                price: v,
              })
            }
            placeholder="AED  0"
          />
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="secondary-button"
            onClick={close}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
          >
            <Save size={16} />
            Save Material
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   SUPPLIER MODAL
============================================================ */

function SupplierModal({ close, save }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    material: "Leather",
    balance: "",
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      alert("Please enter supplier name and phone number.");
      return;
    }
    save({
      ...form,
      name: form.name.trim(),
      phone: form.phone.trim(),
      balance: Number(form.balance || 0),
    });
  };

  return (
    <Modal title="Add Supplier" subtitle="Add a material supplier to your workshop." close={close}>
      <form onSubmit={submit}>
        <div className="modal-grid">
          <Field label="Supplier name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Leather World" />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+971 50 000 0000" />
          <SelectField label="Material" value={form.material} onChange={(v) => setForm({ ...form, material: v })} options={["Leather", "Fabric", "Foam", "Accessories", "Multiple Materials"]} />
          <Field label="Balance" type="number" value={form.balance} onChange={(v) => setForm({ ...form, balance: v })} placeholder="AED 0" />
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={close}>Cancel</button>
          <button type="submit" className="primary-button"><Save size={16} />Save Supplier</button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   STAFF MODAL
============================================================ */

function StaffModal({ close, save }) {
  const [form, setForm] = useState({
    name: "",
    role: "Upholsterer",
    phone: "",
    status: "Active",
  });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      alert("Please enter staff name and phone number.");
      return;
    }
    save({ ...form, name: form.name.trim(), phone: form.phone.trim() });
  };

  return (
    <Modal title="Add Staff" subtitle="Add a workshop employee and assign their role." close={close}>
      <form onSubmit={submit}>
        <div className="modal-grid">
          <Field label="Staff name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Full name" />
          <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+971 50 000 0000" />
          <SelectField label="Role" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={["Upholsterer", "Master Upholsterer", "Leather Technician", "Stitching Specialist", "Foam Technician", "Helper", "Manager"]} />
          <SelectField label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["Active", "On Leave"]} />
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={close}>Cancel</button>
          <button type="submit" className="primary-button"><Save size={16} />Save Staff</button>
        </div>
      </form>
    </Modal>
  );
}

/* ============================================================
   MODAL BASE
============================================================ */

function Modal({
  title,
  subtitle,
  close,
  children,
}) {
  return (
    <div className="overlay">
      <div className="modal">
        <div className="modal-head">
          <div>
            <span>AL KANZ WORKSHOP</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <button
            className="modal-close"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <label className="field">
      <span>{label}</span>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
      >
        {options.map((option) => (
          <option key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/* ============================================================
   COMPLETE CSS
============================================================ */

const BASE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@600;700;800&display=swap');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #f3f7f8;
  --white: #ffffff;
  --soft: #f8fbfb;

  --green: #166b5f;
  --green-dark: #0d5047;
  --green-light: #e4f3ef;

  --sidebar: #0d3d37;
  --sidebar-2: #104941;
  --sidebar-text: #b7d1cc;

  --text: #17282b;
  --text-2: #52676b;
  --muted: #8a9a9d;

  --border: #e1e9ea;

  --blue: #387aaa;
  --blue-light: #e8f2f8;

  --orange: #b9792f;
  --orange-light: #fff1dc;

  --purple: #7557a4;
  --purple-light: #f0eafa;

  --red: #b65d58;
  --red-light: #fae9e7;

  --shadow: 0 8px 30px rgba(20, 53, 57, .055);
}

html,
body,
#root {
  width: 100%;
  min-height: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: "DM Sans", sans-serif;
  -webkit-font-smoothing: antialiased;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
  border: 0;
}

.app {
  min-height: 100vh;
  display: flex;
}

/* SIDEBAR */

.sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: 250px;
  background: var(--sidebar);
  color: var(--sidebar-text);
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.brand-area {
  padding: 25px 18px 18px;
  border-bottom: 1px solid rgba(255,255,255,.07);
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-logo {
  width: 43px;
  height: 43px;
  border-radius: 13px;
  background: #b9df79;
  color: #17483f;
  display: grid;
  place-items: center;
}

.brand strong {
  display: block;
  color: #fff;
  font-family: "Manrope";
  font-size: 14px;
  letter-spacing: .08em;
}

.brand span {
  display: block;
  margin-top: 3px;
  color: #7da39c;
  font-size: 9px;
  letter-spacing: .2em;
  font-weight: 700;
}

.workshop-status {
  height: 38px;
  margin-top: 21px;
  border-radius: 10px;
  background: rgba(255,255,255,.06);
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  color: #c9dfdb;
  font-size: 10px;
  font-weight: 700;
}

.workshop-status span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #a9db69;
  box-shadow: 0 0 0 4px rgba(169,219,105,.1);
}

.nav-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 23px 12px;
}

.nav-group {
  margin-bottom: 22px;
}

.nav-section-title {
  padding: 0 12px 9px;
  color: #70958f;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .2em;
}

.nav-item {
  width: 100%;
  min-height: 42px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 0 11px;
  border-radius: 10px;
  background: transparent;
  color: #b7cfcb;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  transition: .2s;
}

.nav-item:hover {
  background: var(--sidebar-2);
  color: white;
}

.nav-item.selected {
  color: white;
  background: #1a6055;
  box-shadow: inset 3px 0 #b9df79;
}

.nav-item svg:last-child {
  margin-left: auto;
}

.chevron-open {
  transform: rotate(180deg);
}

.sub-menu {
  padding: 4px 0 5px 41px;
}

.sub-menu button {
  width: 100%;
  height: 33px;
  background: transparent;
  color: #82a7a0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  text-align: left;
}

.sub-menu button:hover,
.sub-menu button.sub-selected {
  color: #fff;
}

.sub-menu button > span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #517b74;
}

.sub-menu button.sub-selected > span {
  background: #b9df79;
}

.sidebar-account {
  padding: 14px;
  border-top: 1px solid rgba(255,255,255,.07);
}

.account-card {
  min-height: 53px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px;
  border-radius: 11px;
  background: rgba(255,255,255,.06);
}

.account-avatar {
  width: 33px;
  height: 33px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  background: #b9df79;
  color: #17483f;
  font-size: 9px;
  font-weight: 800;
}

.account-card > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.account-card strong,
.account-card span {
  display: block;
}

.account-card strong {
  color: white;
  font-size: 9px;
}

.account-card span {
  color: #7fa49d;
  margin-top: 2px;
  font-size: 8px;
}

.logout {
  width: 100%;
  height: 33px;
  margin-top: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 7px;
  background: transparent;
  color: #86a8a2;
  border-radius: 9px;
  font-size: 9px;
  font-weight: 700;
}

.logout:hover {
  background: rgba(255,255,255,.06);
  color: white;
}

.mobile-close,
.mobile-menu {
  display: none;
}

/* MAIN */

.main {
  width: calc(100% - 250px);
  margin-left: 250px;
  min-height: 100vh;
}

.topbar {
  height: 72px;
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255,255,255,.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
  padding: 0 34px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.topbar-left,
.topbar-right,
.breadcrumb,
.admin-profile {
  display: flex;
  align-items: center;
}

.breadcrumb {
  gap: 7px;
  font-size: 10px;
  color: var(--muted);
}

.breadcrumb strong {
  color: var(--text);
}

.topbar-right {
  gap: 16px;
}

.global-search {
  width: 315px;
  height: 39px;
  border: 1px solid var(--border);
  background: #f8fafb;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  color: #819396;
}

.global-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-size: 10px;
}

.global-search input::placeholder {
  color: #99a7aa;
}

.global-search kbd {
  padding: 3px 6px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 8px;
  color: #8b999c;
}

.notification {
  width: 37px;
  height: 37px;
  position: relative;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: transparent;
  color: #667c80;
}

.notification:hover {
  background: #eef4f4;
}

.notification i {
  position: absolute;
  width: 5px;
  height: 5px;
  background: #db7163;
  border-radius: 50%;
  right: 9px;
  top: 8px;
}

.admin-menu-wrap {
  position: relative;
}

.admin-profile {
  gap: 8px;
  padding: 3px 5px;
  background: transparent;
  border-radius: 10px;
  color: var(--text);
}

.admin-profile:hover {
  background: #eef4f4;
}

.admin-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 175px;
  padding: 6px;
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 12px 35px rgba(20, 53, 57, .15);
  z-index: 100;
}

.admin-dropdown button {
  width: 100%;
  min-height: 38px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 10px;
  text-align: left;
}

.admin-dropdown button:hover {
  background: var(--green-light);
  color: var(--green);
}

.admin-profile > div {
  width: 35px;
  height: 35px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: #e2f1eb;
  color: var(--green);
  font-size: 9px;
  font-weight: 800;
}

.admin-profile section strong,
.admin-profile section span {
  display: block;
}

.admin-profile section strong {
  font-size: 10px;
}

.admin-profile section span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 8px;
}

/* CONTENT */

.content {
  max-width: 1500px;
  margin: auto;
  padding: 34px 40px 70px;
}

.page-heading,
.page-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 24px;
}

.eyebrow {
  color: #6e898d;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .2em;
}

.page-heading h1,
.page-title h1 {
  margin-top: 8px;
  font-family: "Manrope";
  color: var(--text);
  font-size: 28px;
  line-height: 1.15;
  letter-spacing: -.035em;
}

.page-heading p,
.page-title p {
  margin-top: 6px;
  color: var(--text-2);
  font-size: 11px;
}

.primary-button {
  min-height: 41px;
  padding: 0 16px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--green);
  color: white;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 6px 16px rgba(22,107,95,.17);
  transition: .2s;
}

.primary-button:hover {
  background: var(--green-dark);
  transform: translateY(-1px);
}

/* HERO */

.hero {
  min-height: 235px;
  position: relative;
  overflow: hidden;
  border-radius: 20px;
  padding: 35px 40px;
  background: linear-gradient(115deg,#0d4c43,#16695c 65%,#258171);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 16px 35px rgba(16,79,69,.13);
}

.hero-text {
  position: relative;
  z-index: 3;
}

.hero-text > span {
  color: #a7d2c9;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .2em;
}

.hero-text h2 {
  margin-top: 9px;
  color: white;
  font-family: "Manrope";
  font-size: 27px;
  line-height: 1.18;
  letter-spacing: -.035em;
}

.hero-text p {
  max-width: 500px;
  margin-top: 9px;
  color: #c7dfdb;
  font-size: 11px;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 9px;
  margin-top: 21px;
}

.hero-actions button {
  height: 35px;
  padding: 0 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255,255,255,.12);
  color: white;
  font-size: 9px;
  font-weight: 700;
}

.hero-actions button:first-child {
  background: #c2e982;
  color: #173f37;
}

.hero-visual {
  width: 300px;
  height: 200px;
  position: relative;
  margin-right: 25px;
}

.hero-ring {
  position: absolute;
  border: 1px solid rgba(203,239,161,.22);
  border-radius: 50%;
}

.ring-one {
  width: 185px;
  height: 185px;
  right: 10px;
  top: 7px;
}

.ring-two {
  width: 250px;
  height: 250px;
  right: -25px;
  top: -25px;
}

.hero-sofa {
  position: absolute;
  right: 75px;
  top: 57px;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(213,241,176,.28);
  display: grid;
  place-items: center;
  color: #c7e990;
}

.floating-icon {
  width: 35px;
  height: 35px;
  border-radius: 10px;
  background: rgba(255,255,255,.09);
  border: 1px solid rgba(255,255,255,.1);
  display: grid;
  place-items: center;
  color: #c5e88d;
  position: absolute;
}

.icon-a {
  right: 36px;
  top: 18px;
}

.icon-b {
  right: 204px;
  top: 30px;
}

.icon-c {
  right: 210px;
  bottom: 24px;
}

/* STATS */

.stats {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 14px;
  margin-top: 17px;
}

.stat {
  min-height: 108px;
  padding: 18px;
  border: 1px solid var(--border);
  background: white;
  border-radius: 14px;
  display: flex;
  gap: 12px;
  box-shadow: var(--shadow);
}

.stat-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 10px;
  display: grid;
  place-items: center;
}

.stat > div:last-child span,
.stat > div:last-child strong,
.stat > div:last-child small {
  display: block;
}

.stat span {
  color: var(--text-2);
  font-size: 9px;
  font-weight: 700;
}

.stat strong {
  margin-top: 5px;
  color: var(--text);
  font-family: "Manrope";
  font-size: 19px;
}

.stat small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 8px;
}

.stat.green .stat-icon {
  background: var(--green-light);
  color: var(--green);
}

.stat.blue .stat-icon {
  background: var(--blue-light);
  color: var(--blue);
}

.stat.orange .stat-icon {
  background: var(--orange-light);
  color: var(--orange);
}

.stat.purple .stat-icon {
  background: var(--purple-light);
  color: var(--purple);
}

/* CARDS */

.two-column {
  display: grid;
  grid-template-columns: minmax(0,1.7fr) minmax(300px,.8fr);
  gap: 17px;
  margin-top: 17px;
}

.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.card-header {
  padding: 20px 21px 15px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.card-header > div > span {
  color: #779094;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .18em;
}

.card-header h2 {
  margin-top: 5px;
  color: var(--text);
  font-family: "Manrope";
  font-size: 15px;
}

.card-header p {
  margin-top: 4px;
  color: var(--muted);
  font-size: 8px;
}

.text-button {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  color: var(--green);
  font-size: 9px;
  font-weight: 800;
}

/* JOB LIST */

.job-list {
  padding: 0 20px 7px;
}

.job-card {
  min-height: 104px;
  padding: 14px 1px;
  border-top: 1px solid #edf1f2;
  display: flex;
  align-items: center;
  gap: 11px;
}

.job-product-icon {
  width: 39px;
  height: 39px;
  border-radius: 10px;
  flex-shrink: 0;
  background: #e8f3f1;
  color: var(--green);
  display: grid;
  place-items: center;
}

.job-main {
  flex: 1;
  min-width: 0;
}

.job-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.job-top > strong {
  color: var(--text);
  font-size: 10px;
}

.job-main p {
  margin-top: 4px;
  color: var(--text-2);
  font-size: 8px;
}

.status {
  padding: 4px 7px;
  border-radius: 5px;
  font-size: 7px;
  font-weight: 800;
  white-space: nowrap;
}

.status.in-progress {
  background: #fff0d7;
  color: #936d29;
}

.status.ready,
.status.paid,
.status.income {
  background: #e1f3ed;
  color: #267566;
}

.status.delivered {
  background: #e5f1f7;
  color: #3b7195;
}

.status.part-paid {
  background: #fff0d7;
  color: #956f29;
}

.status.unpaid,
.status.expense {
  background: #fae8e6;
  color: #a75c56;
}

.progress {
  height: 5px;
  margin-top: 11px;
  border-radius: 10px;
  background: #e9eeee;
  overflow: hidden;
}

.progress span {
  height: 100%;
  display: block;
  border-radius: inherit;
  background: linear-gradient(90deg,#278879,#67b6a5);
}

.job-main small {
  display: block;
  margin-top: 4px;
  color: #94a1a3;
  font-size: 7px;
}

.job-money {
  min-width: 92px;
  text-align: right;
}

.job-money strong,
.job-money span,
.job-money small {
  display: block;
}

.job-money strong {
  color: var(--text);
  font-size: 10px;
}

.job-money span {
  margin-top: 4px;
  color: #9ba7a9;
  font-size: 7px;
}

.job-money small {
  margin-top: 4px;
  color: var(--text-2);
  font-size: 7px;
}

.job-money small.paid {
  color: var(--green);
}

.dots {
  width: 27px;
  height: 27px;
  background: transparent;
  color: #9ba8aa;
}

/* QUICK ACTION */

.quick-actions {
  padding: 0 20px 12px;
}

.quick-action {
  width: 100%;
  min-height: 62px;
  border-top: 1px solid #edf1f2;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  text-align: left;
}

.quick-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: #edf6f4;
  color: var(--green);
  display: grid;
  place-items: center;
}

.quick-action > div:nth-child(2) {
  flex: 1;
}

.quick-action strong,
.quick-action span {
  display: block;
}

.quick-action strong {
  color: var(--text);
  font-size: 9px;
}

.quick-action span {
  margin-top: 3px;
  color: var(--muted);
  font-size: 7px;
}

.quick-action > svg {
  color: #9ba8aa;
}

.quick-action:hover .quick-icon {
  background: var(--green);
  color: white;
}

/* SCHEDULE */

.schedule {
  min-height: 60px;
  margin: 0 20px;
  border-top: 1px solid #edf1f2;
  display: flex;
  align-items: center;
  gap: 12px;
}

.schedule-time {
  width: 53px;
  color: #859598;
  font-size: 7px;
}

.schedule-dot {
  width: 5px;
  height: 5px;
  background: #4e9c8b;
  border-radius: 50%;
}

.schedule > div:nth-child(3) {
  flex: 1;
}

.schedule strong,
.schedule span {
  display: block;
}

.schedule strong {
  color: var(--text);
  font-size: 9px;
}

.schedule > div span {
  margin-top: 3px;
  color: var(--muted);
  font-size: 7px;
}

.schedule label {
  padding: 5px 7px;
  border-radius: 5px;
  background: #edf4f4;
  color: #60787b;
  font-size: 7px;
  font-weight: 700;
}

/* FINANCE */

.finance-number {
  padding: 2px 21px 13px;
}

.finance-number span,
.finance-number strong {
  display: block;
}

.finance-number span {
  color: var(--muted);
  font-size: 8px;
}

.finance-number strong {
  margin-top: 4px;
  color: var(--text);
  font-family: "Manrope";
  font-size: 23px;
}

.large-progress {
  height: 7px;
  margin: 0 21px;
  border-radius: 10px;
  background: #edf2f2;
  overflow: hidden;
}

.large-progress span {
  height: 100%;
  display: block;
  border-radius: inherit;
  background: #4e9d8d;
}

.finance-meta {
  display: flex;
  justify-content: space-between;
  padding: 8px 21px 14px;
  color: var(--muted);
  font-size: 7px;
}

.finance-meta strong {
  color: var(--orange);
}

.recent-payments {
  border-top: 1px solid #edf1f2;
  padding: 0 20px;
}

.payment {
  min-height: 54px;
  border-bottom: 1px solid #edf1f2;
  display: flex;
  align-items: center;
  gap: 9px;
}

.payment:last-child {
  border-bottom: 0;
}

.payment-avatar {
  width: 29px;
  height: 29px;
  border-radius: 8px;
  background: #eaf2f3;
  color: #55777a;
  display: grid;
  place-items: center;
  font-size: 7px;
  font-weight: 800;
}

.payment > div:nth-child(2) {
  flex: 1;
}

.payment strong,
.payment span {
  display: block;
}

.payment > div:nth-child(2) strong {
  font-size: 8px;
}

.payment span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 7px;
}

.payment > b {
  color: var(--green);
  font-size: 8px;
}

/* PAGE TOOLBAR */

.toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.filter-search {
  width: 330px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: #899a9d;
}

.filter-search input {
  flex: 1;
  border: 0;
  outline: 0;
  font-size: 10px;
}

.filter-button {
  height: 40px;
  padding: 0 13px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  color: var(--text-2);
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 9px;
}

/* TABLE */

.table-card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  overflow-x: auto;
  box-shadow: var(--shadow);
}

.table-head,
.table-row {
  min-width: 850px;
  display: grid;
  grid-template-columns: 100px 1.2fr 1.4fr 120px 120px 120px 45px;
  align-items: center;
}

.table-head {
  min-height: 43px;
  padding: 0 20px;
  background: #f8fafb;
  border-bottom: 1px solid var(--border);
  color: #849396;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: .12em;
}

.table-row {
  min-height: 75px;
  padding: 0 20px;
  border-bottom: 1px solid #edf1f2;
  color: var(--text-2);
  font-size: 9px;
}

.table-row:last-child {
  border-bottom: 0;
}

.table-row > strong {
  color: var(--text);
  font-size: 9px;
}

.table-row > div strong,
.table-row > div small {
  display: block;
}

.table-row > div small {
  margin-top: 4px;
  color: var(--muted);
  font-size: 7px;
}

.row-action {
  width: 29px;
  height: 29px;
  border-radius: 7px;
  background: #f1f5f5;
  color: #637a7d;
  display: grid;
  place-items: center;
}

.income {
  color: var(--green) !important;
}

.expense {
  color: var(--red) !important;
}

.empty {
  min-height: 250px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 7px;
  color: #8b9a9d;
}

.empty strong {
  color: var(--text);
  font-size: 12px;
}

.empty span {
  font-size: 9px;
}

/* CUSTOMERS */

.customer-grid,
.material-grid,
.staff-grid,
.report-grid {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 15px;
}

.customer-card,
.material-card,
.staff-card,
.report-box {
  background: white;
  border: 1px solid var(--border);
  border-radius: 15px;
  box-shadow: var(--shadow);
}

.customer-card {
  padding: 19px;
}

.customer-top {
  display: flex;
  justify-content: space-between;
}

.customer-avatar,
.staff-avatar {
  width: 43px;
  height: 43px;
  border-radius: 12px;
  background: #e3f2ef;
  color: var(--green);
  display: grid;
  place-items: center;
  font-size: 10px;
  font-weight: 800;
}

.customer-card h3 {
  margin-top: 14px;
  font-family: "Manrope";
  font-size: 13px;
}

.customer-detail {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
  font-size: 8px;
}

.customer-stats {
  margin-top: 17px;
  padding-top: 14px;
  border-top: 1px solid #edf1f2;
  display: flex;
  gap: 30px;
}

.customer-stats span,
.customer-stats strong {
  display: block;
}

.customer-stats span {
  color: var(--muted);
  font-size: 7px;
}

.customer-stats strong {
  margin-top: 4px;
  color: var(--text);
  font-size: 10px;
}

/* MATERIAL */

.material-grid {
  grid-template-columns: repeat(2,1fr);
}

.material-card {
  padding: 17px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.material-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eaf3f1;
  color: var(--green);
  display: grid;
  place-items: center;
}

.material-info {
  flex: 1;
}

.material-info > span {
  color: var(--green);
  font-size: 7px;
  font-weight: 800;
  text-transform: uppercase;
}

.material-info h3 {
  margin-top: 4px;
  font-size: 11px;
}

.material-info p {
  margin-top: 3px;
  color: var(--muted);
  font-size: 8px;
}

.stock {
  text-align: right;
}

.stock strong,
.stock span {
  display: block;
}

.stock strong {
  color: var(--text);
  font-size: 16px;
}

.stock span {
  color: var(--muted);
  font-size: 7px;
}

.low-stock strong {
  color: var(--red);
}

.delete-small {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #faeeee;
  color: #ae6761;
}

/* STAFF */

.staff-grid {
  grid-template-columns: repeat(3,1fr);
}

.staff-card {
  padding: 21px;
}

.staff-card h3 {
  margin-top: 13px;
  font-family: "Manrope";
  font-size: 13px;
}

.staff-card p {
  margin-top: 4px;
  color: var(--green);
  font-size: 9px;
  font-weight: 700;
}

.staff-card > span {
  display: block;
  margin-top: 8px;
  color: var(--muted);
  font-size: 8px;
}

.staff-card label {
  display: inline-block;
  margin-top: 13px;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 7px;
  font-weight: 800;
}

.staff-active {
  color: #267466;
  background: #e1f3ed;
}

.staff-leave {
  color: #9b7029;
  background: #fff0d7;
}

/* BILLING */

.billing-stats {
  display: grid;
  grid-template-columns: repeat(4,1fr);
  gap: 14px;
  margin-bottom: 17px;
}

.invoice-head {
  grid-template-columns: 110px 1.4fr 130px 130px 130px 120px;
}

.invoice-head + .table-row {
  grid-template-columns: 110px 1.4fr 130px 130px 130px 120px;
}

/* REPORTS */

.report-grid {
  grid-template-columns: repeat(4,1fr);
}

.report-box {
  padding: 20px;
}

.report-box > div {
  width: 37px;
  height: 37px;
  border-radius: 9px;
  background: var(--green-light);
  color: var(--green);
  display: grid;
  place-items: center;
}

.report-box > span {
  display: block;
  margin-top: 15px;
  color: var(--text-2);
  font-size: 9px;
}

.report-box > strong {
  display: block;
  margin-top: 5px;
  font-family: "Manrope";
  font-size: 21px;
}

.report-box > small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-size: 7px;
}

.report-chart {
  margin-top: 17px;
  padding-bottom: 20px;
}

.bars {
  height: 270px;
  margin: 15px 25px 0;
  padding: 20px 10px 0;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  gap: 18px;
}

.bar-wrap {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
}

.bar {
  width: 100%;
  max-width: 42px;
  min-height: 10px;
  border-radius: 7px 7px 0 0;
  background: linear-gradient(#5bb0a0,#1d7568);
}

.bar-wrap span {
  margin-top: 8px;
  color: var(--muted);
  font-size: 7px;
}

/* ACCOUNTS */

.account-tabs {
  margin-bottom: 17px;
  padding: 5px;
  width: fit-content;
  border-radius: 9px;
  background: #eaf0f1;
  display: flex;
  gap: 4px;
}

.account-tabs button {
  padding: 8px 13px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font-size: 9px;
  font-weight: 700;
}

.account-tabs button.active {
  background: white;
  color: var(--green);
  box-shadow: 0 2px 8px rgba(0,0,0,.05);
}

.account-overview {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 15px;
  margin-bottom: 17px;
}

.account-big-card {
  padding: 21px;
  border-radius: 14px;
  background: var(--green);
  color: white;
}

.account-big-card:nth-child(2) {
  background: #315d79;
}

.account-big-card:nth-child(3) {
  background: #71578f;
}

.account-big-card span,
.account-big-card strong,
.account-big-card small {
  display: block;
}

.account-big-card span {
  color: rgba(255,255,255,.7);
  font-size: 8px;
}

.account-big-card strong {
  margin-top: 8px;
  font-family: "Manrope";
  font-size: 23px;
}

.account-big-card small {
  margin-top: 5px;
  color: rgba(255,255,255,.62);
  font-size: 7px;
}

/* SETTINGS */

.settings-layout {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  gap: 17px;
  align-items: start;
}

.settings-menu {
  grid-column: 1;
  grid-row: 1 / span 2;
}

.settings-card {
  grid-column: 2;
  grid-row: 1;
}

.appearance-card {
  grid-column: 2;
  grid-row: 2;
}

.settings-menu {
  padding: 9px;
  height: fit-content;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: white;
}

.settings-menu button {
  width: 100%;
  height: 40px;
  padding: 0 11px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  color: var(--text-2);
  font-size: 9px;
  text-align: left;
}

.settings-menu button.active,
.settings-menu button:hover {
  color: var(--green);
  background: var(--green-light);
}

.settings-card {
  min-height: 400px;
}

.settings-form {
  padding: 0 21px 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.settings-form label {
  display: flex;
  flex-direction: column;
  gap: 7px;
  color: var(--text-2);
  font-size: 8px;
  font-weight: 800;
}

.settings-form input {
  height: 39px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0 11px;
  background: #f8fafb;
  color: var(--text);
  font-size: 9px;
}

.settings-form .primary-button {
  width: fit-content;
}

/* MODAL */

.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(13,35,37,.5);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal {
  width: min(720px,100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: 18px;
  background: white;
  box-shadow: 0 30px 90px rgba(0,0,0,.22);
}

.modal-head {
  padding: 23px 25px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
}

.modal-head > div > span {
  color: var(--green);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .18em;
}

.modal-head h2 {
  margin-top: 5px;
  font-family: "Manrope";
  font-size: 21px;
}

.modal-head p {
  margin-top: 5px;
  color: var(--muted);
  font-size: 9px;
}

.modal-close {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #f0f4f4;
  color: #617376;
  display: grid;
  place-items: center;
}

.modal-grid {
  padding: 23px 25px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field span {
  color: #52676a;
  font-size: 8px;
  font-weight: 800;
}

.field input,
.field select {
  height: 40px;
  width: 100%;
  border: 1px solid #dce6e7;
  outline: none;
  border-radius: 8px;
  padding: 0 11px;
  background: #f9fbfb;
  color: var(--text);
  font-size: 9px;
}

.field input:focus,
.field select:focus {
  border-color: #55a295;
  box-shadow: 0 0 0 3px rgba(85,162,149,.1);
  background: white;
}

.modal-footer {
  padding: 15px 25px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.secondary-button {
  min-height: 41px;
  padding: 0 15px;
  border-radius: 9px;
  background: #edf2f2;
  color: #53686b;
  font-size: 9px;
  font-weight: 800;
}

/* RESPONSIVE */

@media(max-width:1150px) {
  .sidebar {
    width: 220px;
  }

  .main {
    width: calc(100% - 220px);
    margin-left: 220px;
  }

  .content {
    padding: 28px 24px 60px;
  }

  .hero-visual {
    transform: scale(.85);
    margin-right: 0;
  }

  .stats {
    grid-template-columns: repeat(2,1fr);
  }

  .two-column {
    grid-template-columns: 1fr;
  }

  .report-grid,
  .customer-grid,
  .staff-grid {
    grid-template-columns: repeat(2,1fr);
  }
}

@media(max-width:850px) {
  .sidebar {
    width: 250px;
    transform: translateX(-100%);
    transition: .25s;
    box-shadow: 15px 0 40px rgba(0,0,0,.15);
  }

  .sidebar.sidebar-open {
    transform: translateX(0);
  }

  .mobile-close {
    display: block;
    margin-left: auto;
    background: transparent;
    color: white;
  }

  .brand {
    padding-right: 5px;
  }

  .main {
    width: 100%;
    margin-left: 0;
  }

  .mobile-menu {
    display: grid;
    place-items: center;
    width: 37px;
    height: 37px;
    border-radius: 8px;
    background: #edf3f3;
    color: var(--text);
    margin-right: 10px;
  }

  .breadcrumb {
    display: none;
  }

  .topbar {
    padding: 0 18px;
  }

  .global-search {
    width: 250px;
  }

  .hero-visual {
    display: none;
  }

  .hero {
    padding: 30px;
  }
}

@media(max-width:620px) {
  .content {
    padding: 22px 14px 50px;
  }

  .topbar {
    height: 64px;
  }

  .admin-profile section,
  .admin-profile > svg {
    display: none;
  }

  .global-search {
    width: 170px;
  }

  .global-search kbd {
    display: none;
  }

  .page-heading,
  .page-title {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .page-heading h1,
  .page-title h1 {
    font-size: 24px;
  }

  .stats,
  .report-grid,
  .customer-grid,
  .staff-grid,
  .account-overview,
  .material-grid {
    grid-template-columns: 1fr;
  }

  .hero {
    padding: 25px;
  }

  .hero-text h2 {
    font-size: 23px;
  }

  .hero-actions {
    flex-wrap: wrap;
  }

  .job-money {
    display: none;
  }

  .toolbar {
    flex-direction: column;
  }

  .filter-search {
    width: 100%;
  }

  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-menu,
  .settings-card,
  .appearance-card {
    grid-column: 1;
    grid-row: auto;
  }

  .settings-form {
    grid-template-columns: 1fr;
  }

  .modal-grid {
    grid-template-columns: 1fr;
  }
}

/* THEMES + SIDEBAR COLLAPSE */
.app.theme-light {
  --bg:#f7f9fb; --white:#fff; --soft:#fbfcfd; --green:#176f62;
  --green-dark:#0e544a; --green-light:#e6f5f1; --sidebar:#174b45;
  --sidebar-2:#216158; --text:#18272b; --text-2:#53666a; --muted:#8b989b;
  --border:#e2e8eb;
}
.app.theme-dark {
  --bg:#111817; --white:#1a2422; --soft:#202b29; --green:#67c5a8;
  --green-dark:#49a88e; --green-light:#1d3b34; --sidebar:#091f1c;
  --sidebar-2:#123a34; --sidebar-text:#b6cbc6; --text:#edf5f2;
  --text-2:#b3c3bf; --muted:#849692; --border:#30403d;
  --blue:#78b5dc; --blue-light:#1c3443; --orange:#d6a15e;
  --orange-light:#3c3020; --purple:#a98bd0; --purple-light:#302741;
  --red:#e08b83; --red-light:#3c2927; --shadow:0 8px 30px rgba(0,0,0,.25);
}
.app.theme-dark .topbar { background:rgba(26,36,34,.94); }
.app.theme-dark .card,.app.theme-dark .jobs-modern-card,.app.theme-dark .table-card,
.app.theme-dark .modal,.app.theme-dark .job-drawer,.app.theme-dark .settings-card,
.app.theme-dark .appearance-card { background:var(--white); border-color:var(--border); color:var(--text); }
.app.theme-dark .global-search,.app.theme-dark .jobs-search-modern,.app.theme-dark .jobs-status-filter,
.app.theme-dark .field input,.app.theme-dark .field select,.app.theme-dark .settings-form input {
  background:#202b29; color:var(--text); border-color:var(--border);
}
.app.theme-dark .jobs-page-header h1,.app.theme-dark .jobs-breadcrumb strong,
.app.theme-dark .card h2,.app.theme-dark .page-title h1 { color:var(--text); }
.app.theme-dark .jobs-page-header p,.app.theme-dark .jobs-eyebrow,
.app.theme-dark .jobs-breadcrumb,.app.theme-dark .card-header p,.app.theme-dark .page-title p { color:var(--muted); }

.sidebar-overlay { display:none; }
.mobile-menu { width:38px;height:38px;display:grid;place-items:center;border-radius:9px;background:transparent;color:#667c80; }
.mobile-menu:hover { background:#eef4f4; }

@media(min-width:851px) {
  .sidebar-collapsed .sidebar { width:78px; }
  .sidebar-collapsed .main { width:calc(100% - 78px); margin-left:78px; }
  .sidebar-collapsed .brand-area { padding-left:17px; padding-right:17px; }
  .sidebar-collapsed .brand > div:last-child,.sidebar-collapsed .workshop-status,
  .sidebar-collapsed .nav-section-title,.sidebar-collapsed .nav-item > span,
  .sidebar-collapsed .nav-item > svg:last-child,.sidebar-collapsed .sub-menu,
  .sidebar-collapsed .account-card > div:not(.account-avatar),
  .sidebar-collapsed .account-card > svg,.sidebar-collapsed .logout { display:none; }
  .sidebar-collapsed .brand { justify-content:center; }
  .sidebar-collapsed .nav-scroll { padding-left:10px;padding-right:10px; }
  .sidebar-collapsed .nav-item { justify-content:center;padding:0; }
  .sidebar-collapsed .sidebar-account { padding:12px 10px; }
  .sidebar-collapsed .account-card { justify-content:center; }
}
.theme-options { display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 25px 25px; }
.theme-option { min-height:84px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--soft);color:var(--text);display:flex;align-items:center;gap:11px;text-align:left;transition:.2s; }
.theme-option:hover { border-color:var(--green);transform:translateY(-1px); }
.theme-option.active { border-color:var(--green);box-shadow:0 0 0 2px var(--green-light); }
.theme-option > div { flex:1; }
.theme-option strong,.theme-option small { display:block; }
.theme-option strong { font-size:12px; }
.theme-option small { margin-top:3px;color:var(--muted);font-size:10px; }
.theme-preview { width:38px;height:38px;flex:0 0 38px;border-radius:9px;border:1px solid var(--border); }
.theme-preview-default { background:linear-gradient(135deg,#0d3d37 0 50%,#b9df79 50%); }
.theme-preview-light { background:linear-gradient(135deg,#fff 0 50%,#e6f5f1 50%); }
.theme-preview-dark { background:linear-gradient(135deg,#091f1c 0 50%,#67c5a8 50%); }
@media(max-width:850px) {
  .sidebar-overlay { display:block;position:fixed;inset:0;z-index:45;border:0;background:rgba(0,0,0,.35); }
  .sidebar { width:250px; }
  .theme-options { grid-template-columns:1fr; }
}

`;


/* ============================================================
   AL KANZ MODERN JOBS UI OVERRIDES
============================================================ */

const AL_KANZ_JOB_UI = `
.jobs-page-modern {
  width: 100%;
  max-width: 1320px;
  margin: 0 auto;
}
.jobs-page-header {
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  gap:24px;
  margin-bottom:28px;
}
.jobs-breadcrumb { display:flex; align-items:center; gap:7px; color:#87958f; font-size:13px; margin-bottom:14px; }
.jobs-breadcrumb strong { color:#31413a; }
.jobs-eyebrow { color:#75857e; font-size:11px; font-weight:800; letter-spacing:1.6px; margin-bottom:8px; }
.jobs-page-header h1 { margin:0; font-size:34px; line-height:1.1; color:#13251d; letter-spacing:-.8px; }
.jobs-page-header p { margin:8px 0 0; color:#7d8d86; font-size:15px; }
.jobs-new-button { border:0; border-radius:11px; padding:13px 18px; background:#087653; color:#fff; font-size:14px; font-weight:800; display:flex; align-items:center; gap:8px; cursor:pointer; box-shadow:0 8px 22px rgba(8,118,83,.18); }
.jobs-toolbar-modern { display:flex; gap:12px; margin-bottom:16px; }
.jobs-search-modern { height:48px; width:370px; background:#fff; border:1px solid #dce7e2; border-radius:10px; display:flex; align-items:center; gap:10px; padding:0 14px; color:#82918a; }
.jobs-search-modern input { border:0; outline:0; width:100%; background:transparent; font-size:14px; color:#17251f; }
.jobs-search-modern button { border:0; background:transparent; color:#82918a; font-size:22px; cursor:pointer; }
.jobs-status-filter { height:48px; border:1px solid #dce7e2; background:#fff; border-radius:10px; padding:0 14px; font-size:14px; color:#35463e; outline:none; }
.jobs-modern-card { background:#fff; border:1px solid #dce7e2; border-radius:15px; overflow:hidden; box-shadow:0 5px 18px rgba(15,45,34,.035); }
.jobs-modern-head,.jobs-modern-row { display:grid; grid-template-columns:1.05fr 1.35fr 1.75fr 1.05fr .8fr .8fr .45fr; align-items:center; }
.jobs-modern-head { min-height:52px; padding:0 20px; background:#f8faf9; border-bottom:1px solid #e7eeeb; color:#84928c; font-size:11px; font-weight:800; letter-spacing:.8px; }
.jobs-modern-row { min-height:92px; padding:0 20px; border-bottom:1px solid #edf2ef; }
.jobs-modern-row:hover { background:#fbfdfc; }
.jobs-id-cell,.jobs-customer-cell,.jobs-work-cell { display:flex; flex-direction:column; gap:5px; min-width:0; }
.jobs-id-cell strong,.jobs-customer-cell strong,.jobs-work-cell strong { color:#22342c; font-size:14px; }
.jobs-id-cell small,.jobs-customer-cell small,.jobs-work-cell small { color:#8a9892; font-size:12px; }
.jobs-money { font-size:14px; color:#1e2d26; }
.jobs-balance { font-size:14px; color:#df4d4d; }
.jobs-balance.paid { color:#087653; }
.jobs-view-button { width:40px; height:40px; border:1px solid #dbe6e1; border-radius:9px; background:#fff; color:#53635c; display:flex; align-items:center; justify-content:center; cursor:pointer; }
.jobs-view-button:hover { border-color:#087653; color:#087653; background:#f1faf6; }
.jobs-modern-footer { padding:14px 20px; color:#899690; font-size:12px; }
.job-drawer-overlay { position:fixed; inset:0; z-index:300; background:rgba(10,28,20,.25); }
.job-drawer { position:fixed; z-index:301; right:0; top:0; width:min(560px,94vw); height:100vh; background:#fff; box-shadow:-18px 0 50px rgba(8,35,25,.16); display:flex; flex-direction:column; animation:akDrawer .22s ease-out; }
@keyframes akDrawer { from{transform:translateX(100%)} to{transform:translateX(0)} }
.job-drawer-header { padding:25px 28px; border-bottom:1px solid #e3ebe7; display:flex; justify-content:space-between; align-items:flex-start; }
.job-drawer-header span { font-size:11px; font-weight:800; letter-spacing:1.4px; color:#83918b; }
.job-drawer-header h2 { margin:7px 0 3px; font-size:27px; color:#087653; }
.job-drawer-header p { margin:0; color:#8a9892; font-size:13px; }
.job-drawer-close { width:40px; height:40px; border:1px solid #dce6e2; background:#fff; border-radius:9px; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#596860; }
.job-drawer-body { overflow:auto; padding:20px 24px 35px; }
.job-detail-grid { display:grid; grid-template-columns:1fr 1fr; border:1px solid #dfe8e4; border-radius:12px; overflow:hidden; margin-bottom:13px; }
.job-detail-box { padding:18px; min-height:140px; }
.job-detail-box:first-child { border-right:1px solid #dfe8e4; }
.job-detail-label { display:flex; align-items:center; gap:8px; color:#087653; font-size:11px; font-weight:800; letter-spacing:.7px; }
.job-detail-box strong { display:block; margin-top:13px; color:#172720; font-size:16px; }
.job-detail-box p { margin:8px 0 0; color:#62716a; font-size:13px; display:flex; align-items:center; gap:6px; line-height:1.5; }
.job-detail-box small { display:block; margin-top:8px; color:#8a9892; font-size:12px; }
.job-detail-section { border:1px solid #dfe8e4; border-radius:12px; padding:18px; margin-bottom:13px; }
.job-section-title { display:flex; align-items:center; gap:8px; color:#087653; font-size:11px; font-weight:800; letter-spacing:.8px; margin-bottom:15px; }
.job-money-row { display:flex; justify-content:space-between; padding:7px 0; font-size:14px; }
.job-money-row span { color:#687770; }
.job-money-row strong { color:#25342d; }
.job-money-row.discount strong { color:#df4d4d; }
.job-total-row { margin-top:9px; padding-top:15px; border-top:1px dashed #cbd7d1; display:flex; justify-content:space-between; align-items:center; }
.job-total-row span { font-size:12px; font-weight:800; color:#26362e; }
.job-total-row strong { font-size:23px; color:#087653; }
.job-paid { color:#087653 !important; }
.job-balance-row { margin-top:8px; padding-top:14px; border-top:1px solid #edf1ef; display:flex; justify-content:space-between; align-items:center; }
.job-balance-row span { font-size:12px; font-weight:800; color:#26362e; }
.job-balance-row strong { font-size:22px; color:#df4d4d; }
.job-payment-button { width:100%; margin-top:14px; height:46px; border:0; border-radius:9px; background:#087653; color:#fff; font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:8px; cursor:pointer; }
.job-payment-button:disabled { background:#b7c6c0; cursor:not-allowed; }
.job-payment-form { margin-top:14px; padding:14px; background:#f7faf8; border-radius:10px; }
.job-payment-form label { font-size:12px; font-weight:700; color:#43534c; }
.job-payment-input { margin-top:7px; height:46px; background:#fff; border:1px solid #d7e2dd; border-radius:9px; display:flex; align-items:center; padding:0 12px; gap:7px; }
.job-payment-input span { color:#74837c; font-size:16px; }
.job-payment-input input { border:0; outline:0; width:100%; font-size:15px; }
.job-payment-actions { display:flex; gap:8px; margin-top:10px; }
.job-payment-actions button { flex:1; height:40px; border-radius:8px; border:1px solid #d8e3de; background:#fff; cursor:pointer; font-weight:700; }
.job-payment-actions button:last-child { border:0; background:#087653; color:#fff; }
.job-status-timeline { display:grid; grid-template-columns:repeat(5,1fr); margin:22px 0 18px; }
.job-status-step { position:relative; text-align:center; color:#9aa7a1; font-size:10px; }
.job-status-step:not(:last-child):after { content:""; position:absolute; left:58%; right:-42%; top:7px; height:2px; background:#dfe6e3; }
.job-status-step.active:not(:last-child):after { background:#087653; }
.job-status-dot { position:relative; z-index:2; width:16px; height:16px; margin:0 auto 7px; border-radius:50%; border:2px solid #cbd7d1; background:#fff; display:flex; align-items:center; justify-content:center; color:#fff; }
.job-status-step.active .job-status-dot { border-color:#087653; background:#087653; }
.job-status-step.current .job-status-dot { box-shadow:0 0 0 5px #dff3e9; }
.job-status-step.active span { color:#33443c; font-weight:700; }
.job-status-label { display:block; font-size:12px; font-weight:700; color:#3d4d46; }
.job-status-label select { width:100%; height:44px; margin-top:7px; border:1px solid #d9e4df; border-radius:9px; background:#fff; padding:0 12px; font-size:13px; outline:none; }
.job-action-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.job-action-grid button { height:46px; border:1px solid #cddbd5; background:#fff; border-radius:9px; color:#087653; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; gap:7px; cursor:pointer; }
.job-notes { margin:0; color:#5d6d65; font-size:13px; line-height:1.65; }
.job-form-section-title { padding:18px 26px 0; }
.job-form-section-title span { font-size:11px; letter-spacing:1px; font-weight:800; color:#087653; }
.job-form-section-title p { margin:5px 0 0; color:#87958f; font-size:12px; }
.job-form-summary { margin:5px 26px 0; padding:17px; background:#f5f8f6; border:1px solid #dfe8e4; border-radius:11px; }
.job-form-summary>div { display:flex; justify-content:space-between; padding:6px 0; font-size:13px; }
.job-form-summary span { color:#697870; }
.job-form-summary strong { color:#26362f; }
.job-form-summary .discount strong { color:#df4d4d; }
.job-form-summary .summary-total { margin-top:8px; padding-top:14px; border-top:1px dashed #cbd7d1; }
.job-form-summary .summary-total span { color:#25352d; font-weight:800; }
.job-form-summary .summary-total strong { color:#087653; font-size:22px; }
.job-form-balance { margin:13px 26px 0; padding:14px 16px; border-radius:10px; background:#fff3df; display:flex; justify-content:space-between; align-items:center; }
.job-form-balance span { color:#9b6816; font-size:11px; font-weight:800; }
.job-form-balance strong { color:#9b6816; font-size:18px; }
.job-form-balance.clear { background:#e7f6ef; }
.job-form-balance.clear span,.job-form-balance.clear strong { color:#087653; }
.job-form-notes { padding:18px 26px 0; }
.job-form-notes label { display:block; color:#45564e; font-size:12px; font-weight:700; margin-bottom:7px; }
.job-form-notes textarea { width:100%; resize:vertical; border:1px solid #d9e4df; border-radius:9px; padding:11px 12px; outline:none; font:inherit; font-size:13px; color:#1b2b24; background:#fbfcfc; }
@media(max-width:900px){ .jobs-modern-head,.jobs-modern-row{grid-template-columns:1fr 1.2fr 1.5fr .9fr .8fr .8fr .5fr; min-width:900px;} .jobs-modern-card{overflow-x:auto;} }
@media(max-width:650px){ .jobs-page-header{align-items:flex-start; flex-direction:column;} .jobs-toolbar-modern{flex-direction:column;} .jobs-search-modern{width:100%;} .job-drawer{width:100%;} .job-detail-grid{grid-template-columns:1fr;} .job-detail-box:first-child{border-right:0;border-bottom:1px solid #dfe8e4;} }

/* ============================================================
   ADMIN DROPDOWN + BILLING TERMINAL + LIVE REPORTS
============================================================ */
.admin-menu-wrap { position:relative; }
.admin-profile { border:0; background:transparent; padding:4px 6px; border-radius:12px; cursor:pointer; color:inherit; }
.admin-profile:hover,.admin-profile.admin-active { background:#eef5f3; }
.admin-dropdown { position:absolute; right:0; top:calc(100% + 9px); width:220px; padding:10px; background:#fff; border:1px solid var(--border); border-radius:14px; box-shadow:0 18px 45px rgba(18,52,47,.14); z-index:120; animation:adminDrop .16s ease-out; }
@keyframes adminDrop { from{opacity:0;transform:translateY(-5px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
.admin-dropdown-head { display:flex; gap:10px; align-items:center; padding:8px 8px 11px; margin-bottom:4px; border-bottom:1px solid #edf2f1; }
.admin-dropdown-avatar { width:35px; height:35px; display:grid; place-items:center; border-radius:10px; background:#e4f3ef; color:#166b5f; font-size:10px; font-weight:800; }
.admin-dropdown-head strong,.admin-dropdown-head span { display:block; }
.admin-dropdown-head strong { font-size:11px; }
.admin-dropdown-head span { margin-top:2px; color:var(--muted); font-size:8px; }
.admin-dropdown > button { width:100%; height:38px; display:flex; align-items:center; gap:9px; padding:0 9px; border-radius:8px; background:transparent; color:#4c6261; font-size:10px; font-weight:700; text-align:left; }
.admin-dropdown > button:hover { background:#f0f6f4; color:var(--green); }
.billing-machine { position:relative; display:grid; grid-template-columns:minmax(0,1.55fr) minmax(190px,.75fr); gap:0; margin-bottom:18px; min-height:230px; border-radius:18px; overflow:hidden; background:linear-gradient(135deg,#0c4a42,#166b5f 60%,#0d3d37); box-shadow:0 15px 42px rgba(11,61,55,.16); }
.billing-machine-screen { position:relative; padding:24px 28px; color:#fff; overflow:hidden; }
.machine-topline { display:flex; justify-content:space-between; align-items:center; font-size:9px; letter-spacing:1.4px; font-weight:800; color:#c5e4de; }
.machine-topline b { font-size:8px; letter-spacing:.8px; color:#d8f1b8; }
.machine-topline b i { display:inline-block; width:6px; height:6px; border-radius:50%; background:#b9df79; margin-right:5px; box-shadow:0 0 0 5px rgba(185,223,121,.08); animation:terminalPulse 1.7s infinite; }
@keyframes terminalPulse { 50%{box-shadow:0 0 0 8px rgba(185,223,121,0)} }
.machine-main { display:flex; align-items:center; justify-content:space-between; gap:20px; margin-top:35px; }
.machine-main small,.machine-main span { display:block; color:#9cc3bb; font-size:8px; letter-spacing:.9px; }
.machine-main strong { display:block; margin:7px 0; font:800 31px Manrope,sans-serif; color:#fff; }
.machine-main span { letter-spacing:0; }
.machine-ring { width:122px; height:122px; border-radius:50%; display:grid; place-items:center; background:conic-gradient(#b9df79 var(--billing-progress),rgba(255,255,255,.11) 0); box-shadow:0 0 0 1px rgba(255,255,255,.09); animation:ringFloat 3s ease-in-out infinite; }
.machine-ring:before { content:""; position:absolute; width:92px; height:92px; border-radius:50%; background:#10564d; }
.machine-ring > div { position:relative; z-index:1; text-align:center; }
.machine-ring b { display:block; color:#fff; font-size:19px; }
.machine-ring span { margin-top:2px; color:#9fc7bf; font-size:7px; }
@keyframes ringFloat { 50%{transform:translateY(-4px) rotate(2deg)} }
.machine-scanline { position:absolute; left:0; right:0; top:0; height:2px; background:rgba(185,223,121,.55); box-shadow:0 0 15px rgba(185,223,121,.35); animation:scan 4s linear infinite; }
@keyframes scan { from{transform:translateY(0)} to{transform:translateY(205px)} }
.billing-machine-receipt { position:relative; padding:25px 25px 18px; background:#f9fbfa; color:#1a2c28; display:flex; flex-direction:column; justify-content:center; clip-path:polygon(0 0,100% 0,100% 96%,96% 100%,92% 96%,88% 100%,84% 96%,80% 100%,76% 96%,72% 100%,68% 96%,64% 100%,60% 96%,56% 100%,52% 96%,48% 100%,44% 96%,40% 100%,36% 96%,32% 100%,28% 96%,24% 100%,20% 96%,16% 100%,12% 96%,8% 100%,4% 96%,0 100%); }
.billing-machine-receipt:before { content:""; position:absolute; inset:12px; border:1px dashed #d8e3df; pointer-events:none; }
.billing-machine-receipt > * { position:relative; z-index:1; }
.billing-machine-receipt > span { font-size:8px; letter-spacing:1.6px; color:#81908b; font-weight:800; }
.billing-machine-receipt > strong { margin-top:9px; font:800 18px Manrope,sans-serif; color:#166b5f; }
.receipt-line { display:flex; gap:5px; margin:17px 0; }
.receipt-line i { height:5px; flex:1; border-radius:4px; background:#dfe9e5; animation:receiptWave 1.6s ease-in-out infinite; }
.receipt-line i:nth-child(2){animation-delay:.15s}.receipt-line i:nth-child(3){animation-delay:.3s}
@keyframes receiptWave { 50%{transform:scaleY(.45);opacity:.6} }
.billing-machine-receipt small { color:#82908b; font-size:8px; line-height:1.5; }
.machine-status { position:absolute; bottom:12px; left:27px; color:#b9d7d0; font-size:8px; z-index:3; }
.machine-status span { display:inline-block; width:6px; height:6px; border-radius:50%; background:#b9df79; margin-right:5px; }
.machine-status b { color:#d8efc0; }
.reports-chart-grid { display:grid; grid-template-columns:1.25fr .85fr; gap:17px; }
.daily-expense-card { min-width:0; }
.live-bars { gap:10px; }
.animated-bar { animation:barRise .7s ease-out both; transform-origin:bottom; }
@keyframes barRise { from{transform:scaleY(0)} to{transform:scaleY(1)} }
.expense-bars { height:270px; margin:15px 22px 0; padding:12px 6px 0; border-bottom:1px solid var(--border); display:flex; align-items:flex-end; gap:10px; }
.expense-bar-wrap { flex:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; min-width:0; }
.expense-bar { width:min(32px,70%); min-height:4px; border-radius:7px 7px 0 0; background:linear-gradient(#d59a4e,#a96720); animation:barRise .7s ease-out both; transform-origin:bottom; }
.expense-value { margin-bottom:5px; color:#9a6b2d; font-size:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:48px; }
.expense-day { margin-top:8px; color:var(--muted); font-size:7px; white-space:nowrap; }
@media(max-width:900px){ .billing-machine{grid-template-columns:1fr}.billing-machine-receipt{min-height:170px}.reports-chart-grid{grid-template-columns:1fr}.admin-dropdown{right:-4px} }
@media(max-width:600px){ .machine-main strong{font-size:25px}.machine-ring{width:95px;height:95px}.machine-ring:before{width:72px;height:72px}.billing-machine-screen{padding:20px}.billing-machine-receipt{padding:20px}.reports-chart-grid{gap:12px} }

`;



const AL_KANZ_ANIMATED_UI = `
/* ============================================================
   AL KANZ — FULL ANIMATED / RESPONSIVE EXPERIENCE
============================================================ */

html {
  scroll-behavior: smooth;
}

* {
  -webkit-tap-highlight-color: transparent;
}

body {
  overflow-x: hidden;
}

.app {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(circle at 8% 5%, rgba(30,126,104,.075), transparent 28%),
    radial-gradient(circle at 92% 18%, rgba(185,223,121,.09), transparent 26%),
    var(--bg);
}

.app::before {
  content: "";
  position: fixed;
  inset: -20%;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(circle at 20% 25%, rgba(102,197,168,.06), transparent 22%),
    radial-gradient(circle at 80% 70%, rgba(185,223,121,.055), transparent 24%);
  animation: akAmbient 18s ease-in-out infinite alternate;
}

@keyframes akAmbient {
  0% { transform: translate3d(-1%, -1%, 0) scale(1); }
  50% { transform: translate3d(1.5%, 1%, 0) scale(1.03); }
  100% { transform: translate3d(-.5%, 1.5%, 0) scale(1.015); }
}

/* Smooth page entrance */
.content > * {
  animation: akPageIn .48s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes akPageIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Sidebar */
.sidebar {
  transition:
    width .28s ease,
    transform .28s cubic-bezier(.2,.8,.2,1),
    box-shadow .28s ease;
}

.nav-item {
  transition:
    transform .2s ease,
    background .2s ease,
    color .2s ease,
    padding .25s ease;
}

.nav-item:hover {
  transform: translateX(3px);
}

.nav-item.selected {
  animation: akNavPulse .35s ease-out;
}

@keyframes akNavPulse {
  0% { transform: scale(.98); }
  100% { transform: scale(1); }
}

.sub-menu {
  animation: akSubMenu .24s ease-out both;
  transform-origin: top;
}

@keyframes akSubMenu {
  from { opacity: 0; transform: translateY(-5px) scaleY(.96); }
  to { opacity: 1; transform: translateY(0) scaleY(1); }
}

.chevron-open {
  transition: transform .25s ease;
  transform: rotate(180deg);
}

/* Top bar */
.topbar {
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  transition: background .25s ease, box-shadow .25s ease;
}

.mobile-menu,
.notification,
.admin-profile {
  transition:
    transform .2s ease,
    background .2s ease,
    box-shadow .2s ease;
}

.mobile-menu:hover,
.notification:hover,
.admin-profile:hover {
  transform: translateY(-1px);
}

.mobile-menu:active,
.notification:active,
.admin-profile:active,
button:active {
  transform: scale(.97);
}

/* Search */
.global-search {
  transition: width .25s ease, border-color .2s ease, box-shadow .2s ease;
}

.global-search:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-light);
}

/* Cards */
.card,
.table-card,
.jobs-modern-card,
.customer-card,
.staff-card,
.material-card,
.account-card,
.report-card,
.billing-machine,
.settings-card,
.appearance-card {
  transition:
    transform .25s ease,
    box-shadow .25s ease,
    border-color .25s ease;
}

.card:hover,
.customer-card:hover,
.staff-card:hover,
.material-card:hover,
.report-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 14px 35px rgba(20,55,47,.10);
}

/* Buttons */
.primary-button,
.secondary-button,
.hero-actions button,
.row-action,
.job-action-grid button,
.job-payment-button {
  transition:
    transform .2s ease,
    box-shadow .2s ease,
    filter .2s ease,
    background .2s ease;
}

.primary-button:hover,
.job-payment-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 9px 22px rgba(8,118,83,.22);
  filter: brightness(1.04);
}

.secondary-button:hover,
.row-action:hover,
.job-action-grid button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(20,55,47,.10);
}

/* Animated stats */
.stat-card {
  animation: akCardIn .55s cubic-bezier(.2,.8,.2,1) both;
}

.stat-card:nth-child(2) { animation-delay: .06s; }
.stat-card:nth-child(3) { animation-delay: .12s; }
.stat-card:nth-child(4) { animation-delay: .18s; }

@keyframes akCardIn {
  from { opacity: 0; transform: translateY(16px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Number/icon micro animations */
.stat-card svg,
.card-header svg {
  transition: transform .3s ease;
}

.stat-card:hover svg,
.card:hover .card-header svg {
  transform: scale(1.08) rotate(-3deg);
}

/* Progress */
.progress-bar > div {
  transform-origin: left center;
  animation: akProgress .9s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes akProgress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* Billing machine */
.billing-machine {
  position: relative;
  overflow: hidden;
  animation: akMachineIn .65s cubic-bezier(.2,.8,.2,1) both;
}

.billing-machine::before {
  content: "";
  position: absolute;
  width: 220px;
  height: 220px;
  right: -80px;
  top: -90px;
  border-radius: 50%;
  background: var(--green-light);
  opacity: .65;
  animation: akMachineOrb 8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes akMachineIn {
  from { opacity: 0; transform: translateY(18px) scale(.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes akMachineOrb {
  0%,100% { transform: translate(0,0) scale(1); }
  50% { transform: translate(-25px,20px) scale(1.12); }
}

.machine-ring {
  animation: akRingFloat 4s ease-in-out infinite;
}

@keyframes akRingFloat {
  0%,100% { transform: translateY(0) rotate(0); }
  50% { transform: translateY(-5px) rotate(2deg); }
}

.billing-machine-receipt {
  animation: akReceipt 1.1s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes akReceipt {
  from { opacity: 0; transform: translateY(15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Charts */
.report-chart,
.chart-card,
.reports-chart-card {
  overflow: hidden;
}

.report-chart svg,
.chart-card svg {
  animation: akChartDraw 1.2s ease-out both;
}

@keyframes akChartDraw {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Modals / drawer */
.modal-backdrop,
.modal-overlay {
  animation: akFade .2s ease-out both;
}

.modal,
.job-drawer {
  animation: akModalIn .3s cubic-bezier(.2,.8,.2,1) both;
}

@keyframes akFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes akModalIn {
  from { opacity: 0; transform: translateY(18px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* Admin / notifications */
.admin-menu-wrap,
.notification-wrap {
  position: relative;
}

.admin-dropdown,
.notification-popover {
  animation: akDrop .22s cubic-bezier(.2,.8,.2,1) both;
  transform-origin: top right;
}

@keyframes akDrop {
  from { opacity: 0; transform: translateY(-6px) scale(.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.notification-wrap {
  display: flex;
  align-items: center;
}

.notification.active {
  background: var(--green-light);
  color: var(--green);
}

.notification-popover {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: 310px;
  padding: 10px;
  z-index: 1000;
  border: 1px solid var(--border);
  border-radius: 15px;
  background: var(--white);
  color: var(--text);
  box-shadow: 0 20px 50px rgba(0,0,0,.16);
}

.popover-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 8px 12px;
  border-bottom: 1px solid var(--border);
}

.popover-title div {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.popover-title span {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1px;
  color: var(--green);
}

.popover-title strong {
  font-size: 14px;
}

.popover-title button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 8px;
  background: var(--soft);
  color: var(--text);
  cursor: pointer;
}

.notification-item {
  display: flex;
  gap: 10px;
  padding: 13px 8px;
}

.notification-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--green-light);
  color: var(--green);
}

.notification-item strong {
  display: block;
  font-size: 12px;
}

.notification-item p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
}

.notification-footer {
  width: 100%;
  min-height: 36px;
  border: 0;
  border-radius: 9px;
  background: var(--soft);
  color: var(--green);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

/* Tables/cards on hover */
.table-row {
  transition: background .2s ease, transform .2s ease;
}

.table-row:hover {
  background: var(--soft);
}

/* Touch targets */
@media (max-width: 850px) {
  .sidebar {
    z-index: 50;
  }

  .sidebar-overlay {
    z-index: 45;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    animation: akFade .2s ease-out both;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
  }

  .content {
    min-width: 0;
  }

  .global-search {
    min-width: 0;
  }

  .notification-popover,
  .admin-dropdown {
    position: fixed;
    top: 68px;
    right: 12px;
    width: min(310px, calc(100vw - 24px));
  }

  .mobile-menu,
  .notification,
  .admin-profile {
    min-width: 40px;
    min-height: 40px;
  }
}

@media (max-width: 620px) {
  .topbar {
    gap: 8px;
    padding: 0 12px;
  }

  .topbar-left {
    min-width: 40px;
  }

  .topbar-right {
    gap: 5px;
    margin-left: auto;
  }

  .global-search {
    width: min(42vw, 170px);
  }

  .global-search input {
    min-width: 0;
  }

  .content {
    padding-left: 12px;
    padding-right: 12px;
  }

  .page-title h1 {
    font-size: 22px;
  }

  .page-title p {
    max-width: 100%;
  }

  .card,
  .table-card,
  .jobs-modern-card,
  .billing-machine {
    border-radius: 13px;
  }

  .primary-button,
  .secondary-button {
    min-height: 44px;
  }

  .notification-popover,
  .admin-dropdown {
    top: 66px;
  }

  .admin-profile {
    padding: 0 2px;
  }

  .admin-profile > div {
    margin: 0;
  }

  /* Prevent wide tables from breaking the viewport. */
  .table-card,
  .jobs-modern-card {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .table-head,
  .table-row {
    min-width: 650px;
  }

  .jobs-modern-head,
  .jobs-modern-row {
    min-width: 900px;
  }

  .billing-machine {
    width: 100%;
  }
}

/* Respect reduced-motion accessibility preference. */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

const CSS = BASE_CSS + AL_KANZ_JOB_UI + AL_KANZ_ANIMATED_UI;



/* ============================================================
   FINAL MOBILE DRAWER / RESPONSIVE OVERRIDES
   Desktop remains unchanged. Mobile uses an overlay drawer.
============================================================ */
const AL_KANZ_FINAL_RESPONSIVE = `
@media (max-width: 850px) {
  html, body, #root {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }

  body {
    min-width: 0;
  }

  .app {
    width: 100%;
    min-width: 0;
    display: block;
    overflow-x: hidden;
  }

  /* Never let the desktop collapsed-sidebar mode affect mobile. */
  .app.sidebar-collapsed .main {
    width: 100% !important;
    margin-left: 0 !important;
  }

  .app .main {
    width: 100% !important;
    margin-left: 0 !important;
    min-width: 0;
  }

  /* Real mobile drawer: it overlays the page instead of squeezing it. */
  .app .sidebar {
    position: fixed !important;
    left: 0;
    top: 0;
    bottom: 0;
    width: min(310px, 86vw) !important;
    max-width: 86vw;
    height: 100dvh;
    transform: translateX(-105%) !important;
    transition: transform .32s cubic-bezier(.22,.8,.2,1), box-shadow .32s ease !important;
    z-index: 1001 !important;
    box-shadow: none;
    overflow: hidden;
  }

  .app .sidebar.sidebar-open {
    transform: translateX(0) !important;
    box-shadow: 22px 0 55px rgba(0,0,0,.28);
  }

  .app .sidebar-overlay {
    display: block !important;
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    padding: 0 !important;
    border: 0 !important;
    background: rgba(0,0,0,.48) !important;
    z-index: 1000 !important;
    cursor: pointer;
    animation: akOverlayIn .22s ease both;
  }

  @keyframes akOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .app .brand-area {
    padding: 22px 17px 17px !important;
    flex: 0 0 auto;
  }

  .app .nav-scroll {
    min-height: 0;
    padding: 20px 12px 25px !important;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
  }

  .app .sidebar-account {
    flex: 0 0 auto;
    padding-bottom: max(14px, env(safe-area-inset-bottom)) !important;
  }

  .app .mobile-close {
    display: grid !important;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    color: #fff;
    background: rgba(255,255,255,.07);
    position: absolute;
    right: 14px;
    top: 18px;
  }

  .app .mobile-close:hover {
    background: rgba(255,255,255,.14);
  }

  .app .brand {
    padding-right: 48px;
  }

  .app .nav-item {
    min-height: 46px;
    font-size: 12px;
  }

  .app .sub-menu {
    padding-left: 42px;
    padding-bottom: 7px;
  }

  .app .sub-menu button {
    min-height: 38px;
    height: 38px;
    font-size: 11px;
  }

  /* Mobile topbar */
  .app .topbar {
    width: 100%;
    max-width: 100%;
    height: 64px;
    padding: 0 12px;
    gap: 7px;
    overflow: visible;
  }

  .app .topbar-left {
    min-width: 40px;
    flex: 0 0 auto;
  }

  .app .mobile-menu {
    display: grid !important;
    place-items: center;
    width: 42px !important;
    height: 42px !important;
    min-width: 42px;
    min-height: 42px;
    margin: 0 !important;
    border-radius: 11px;
    background: var(--green-light) !important;
    color: var(--green) !important;
  }

  .app .topbar-right {
    min-width: 0;
    flex: 1;
    justify-content: flex-end;
    gap: 5px;
  }

  .app .global-search {
    flex: 1 1 auto;
    width: auto !important;
    min-width: 0;
    max-width: 190px;
    height: 40px;
  }

  .app .global-search input {
    min-width: 0;
    font-size: 11px;
  }

  .app .global-search kbd {
    display: none;
  }

  .app .notification {
    width: 40px;
    height: 40px;
    flex: 0 0 40px;
  }

  .app .admin-profile {
    width: 40px;
    height: 40px;
    min-width: 40px;
    padding: 0 !important;
    justify-content: center;
  }

  .app .admin-profile > div {
    width: 34px;
    height: 34px;
  }

  .app .admin-profile section,
  .app .admin-profile > svg {
    display: none !important;
  }

  .app .content {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 20px 14px 50px !important;
    overflow-x: hidden;
  }

  /* Stack common layouts cleanly on phones. */
  .app .stats,
  .app .report-grid,
  .app .customer-grid,
  .app .staff-grid,
  .app .account-overview,
  .app .material-grid,
  .app .two-column,
  .app .report-layout,
  .app .reports-chart-grid,
  .app .billing-machine,
  .app .settings-layout {
    width: 100%;
    min-width: 0;
  }

  .app .stats,
  .app .report-grid,
  .app .customer-grid,
  .app .staff-grid,
  .app .account-overview,
  .app .material-grid,
  .app .reports-chart-grid {
    grid-template-columns: 1fr !important;
  }

  .app .two-column,
  .app .billing-machine,
  .app .settings-layout {
    grid-template-columns: 1fr !important;
  }

  .app .hero {
    width: 100%;
    min-width: 0;
    padding: 22px !important;
  }

  .app .hero-visual {
    display: none !important;
  }

  .app .hero-text {
    width: 100%;
  }

  .app .hero-text h2 {
    font-size: clamp(22px, 7vw, 30px);
    line-height: 1.12;
  }

  .app .hero-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .app .hero-actions button,
  .app .page-heading button,
  .app .page-title button {
    min-height: 44px;
  }

  /* Keep wide tables usable by scrolling only the table area. */
  .app .table-card,
  .app .jobs-modern-card {
    width: 100%;
    max-width: 100%;
    overflow-x: auto !important;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  .app .table-card > *,
  .app .jobs-modern-card > * {
    min-width: 620px;
  }

  /* Drawers/modals fit inside a phone. */
  .app .modal,
  .app .job-drawer {
    width: min(94vw, 680px) !important;
    max-width: 94vw !important;
    max-height: 90dvh;
    overflow-y: auto;
  }

  .app .modal-grid,
  .app .settings-form {
    grid-template-columns: 1fr !important;
  }

  .app .modal-footer {
    flex-wrap: wrap;
  }

  .app .modal-footer button {
    flex: 1 1 130px;
    min-height: 42px;
  }

  /* Popovers remain inside the viewport. */
  .app .notification-popover,
  .app .admin-dropdown {
    position: fixed !important;
    top: 70px !important;
    right: 10px !important;
    left: auto !important;
    width: min(320px, calc(100vw - 20px)) !important;
    max-width: calc(100vw - 20px);
    z-index: 1200 !important;
  }
}

@media (max-width: 420px) {
  .app .global-search {
    max-width: 145px;
  }

  .app .content {
    padding-left: 11px !important;
    padding-right: 11px !important;
  }

  .app .page-heading h1,
  .app .page-title h1 {
    font-size: 22px;
  }

  .app .hero {
    padding: 19px !important;
  }
}

@media (min-width: 851px) {
  /* Desktop stays a true desktop layout. */
  .app .sidebar {
    transform: none;
  }

  .app .sidebar-overlay {
    display: none !important;
  }
}
`;



const AL_KANZ_FINAL_FIX = `
html, body, #root { width:100%; min-width:0; margin:0; }
.app { width:100%; min-width:0; overflow-x:hidden; }
.main, .content { min-width:0; }
.nav-item { position:relative; }

/* BILLING: bill -> wave letters -> printer -> paper */
.bill-create-panel { display:flex; flex-direction:column; align-items:flex-start; }
.create-bill-button { margin-top:14px; min-height:40px; padding:0 14px; border:0; border-radius:10px; display:inline-flex; align-items:center; gap:8px; background:#b9df79; color:#17483f; font-size:11px; font-weight:900; cursor:pointer; box-shadow:0 7px 18px rgba(185,223,121,.16); transition:transform .2s ease, box-shadow .2s ease; }
.create-bill-button:hover { transform:translateY(-2px); box-shadow:0 10px 24px rgba(185,223,121,.25); }
.create-bill-button:active { transform:scale(.96); }
.billing-transfer-animation { position:absolute; left:28px; right:28px; bottom:21px; height:48px; display:flex; align-items:center; gap:12px; pointer-events:none; z-index:4; }
.bill-source { width:54px; flex:0 0 54px; display:flex; align-items:center; gap:5px; color:#d9efe9; font-size:7px; font-weight:900; letter-spacing:1px; }
.bill-paper-icon { width:32px; height:32px; border-radius:8px; display:grid; place-items:center; background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.12); }
.wave-track { position:relative; height:42px; flex:1; display:flex; align-items:center; justify-content:space-around; overflow:visible; }
.wave-track:before { content:""; position:absolute; left:0; right:0; top:50%; height:2px; background:repeating-linear-gradient(90deg,rgba(185,223,121,.18) 0 7px,transparent 7px 13px); transform:translateY(-50%); }
.wave-track span { position:relative; z-index:2; width:22px; height:22px; display:grid; place-items:center; border-radius:50%; color:#b9df79; background:#0d4c43; border:1px solid rgba(185,223,121,.45); font-size:8px; font-weight:900; opacity:.55; }
.billing-machine.is-printing .wave-track span { animation:billingWaveTravel 1.25s cubic-bezier(.2,.75,.25,1) infinite; animation-delay:var(--wave-delay); }
@keyframes billingWaveTravel { 0%{transform:translate3d(-28px,13px,0) scale(.72);opacity:0} 18%{opacity:1} 45%{transform:translate3d(0,-11px,0) scale(1.08)} 70%{transform:translate3d(22px,10px,0) scale(.95)} 100%{transform:translate3d(42px,0,0) scale(.65);opacity:0} }
.printer-icon { position:relative; width:43px; height:34px; flex:0 0 43px; border-radius:8px; display:grid; place-items:center; color:#dff4ed; background:#0b3934; border:1px solid rgba(255,255,255,.15); }
.printer-icon i { position:absolute; bottom:-3px; width:22px; height:4px; border-radius:2px; background:#b9df79; opacity:.7; }
.billing-machine.is-printing .printer-icon { animation:printerShake .45s ease-in-out infinite alternate; }
@keyframes printerShake { from{transform:translateY(0) rotate(-1deg)} to{transform:translateY(-2px) rotate(1deg)} }
.receipt-printer { position:relative; margin:-2px auto 13px; width:min(220px,90%); height:88px; border-radius:12px 12px 8px 8px; background:#e7efec; border:1px solid #d2dfda; overflow:hidden; box-shadow:inset 0 -5px 0 rgba(23,69,62,.05); }
.printer-top { height:30px; display:flex; align-items:center; justify-content:center; gap:6px; color:#55706a; font-size:7px; font-weight:900; letter-spacing:1px; }
.printer-light { width:6px; height:6px; border-radius:50%; background:#62b993; box-shadow:0 0 0 4px rgba(98,185,147,.10); }
.printer-slot { position:absolute; left:25px; right:25px; top:29px; height:7px; border-radius:4px; background:#7f928c; overflow:visible; }
.printed-paper { position:absolute; left:10px; right:10px; top:2px; height:0; padding:0 10px; overflow:hidden; background:#fff; border:1px solid #d9e3df; border-radius:0 0 4px 4px; display:flex; flex-direction:column; align-items:center; color:#36524b; font-size:6px; }
.printed-paper strong { margin-top:8px; font-size:8px; color:#166b5f; }
.printed-paper span { margin-top:2px; font-size:5px; letter-spacing:.6px; }
.printed-paper i { width:75%; height:1px; margin:5px 0; background:#dce7e3; }
.printed-paper small { font-size:5px; color:#82908b; }
.printed-paper b { margin-top:3px; font-size:7px; color:#263b35; }
.billing-machine.is-printing .printed-paper { animation:paperRollOut 2.6s cubic-bezier(.18,.7,.2,1) .75s forwards; }
@keyframes paperRollOut { 0%{height:0;padding-top:0;padding-bottom:0;transform:translateY(0)} 45%{height:45px;padding-top:2px;padding-bottom:2px} 100%{height:75px;padding-top:4px;padding-bottom:4px;transform:translateY(0)} }
.receipt-caption { font-size:8px !important; letter-spacing:1.6px; }
.billing-machine.is-printing .receipt-line i { animation-duration:.55s; }

/* Mobile = real slide-in drawer, never a squeezed desktop sidebar */
@media (max-width:850px) {
  .app { display:block; }
  .main { width:100% !important; margin-left:0 !important; }
  .sidebar { position:fixed !important; left:0 !important; top:0 !important; bottom:0 !important; width:min(300px,86vw) !important; max-width:300px !important; height:100% !important; transform:translate3d(-105%,0,0) !important; z-index:1000 !important; box-shadow:18px 0 55px rgba(0,0,0,.28) !important; transition:transform .32s cubic-bezier(.2,.8,.2,1) !important; }
  .sidebar.sidebar-open { transform:translate3d(0,0,0) !important; }
  .sidebar-overlay { position:fixed !important; inset:0 !important; width:100% !important; height:100% !important; display:block !important; z-index:999 !important; background:rgba(3,18,15,.52) !important; backdrop-filter:blur(2px); -webkit-backdrop-filter:blur(2px); }
  .mobile-menu { display:grid !important; width:42px !important; height:42px !important; flex:0 0 42px; place-items:center; border-radius:11px !important; background:var(--soft) !important; color:var(--text) !important; }
  .topbar { position:sticky; top:0; z-index:80; }
  .topbar-left,.topbar-right { min-width:0; }
  .global-search { max-width:min(42vw,220px); }
  .content { width:100% !important; max-width:100% !important; padding:20px 14px 45px !important; box-sizing:border-box; }
  .breadcrumb span { display:none; }
  .admin-profile section { display:none !important; }
  .admin-profile { min-width:42px; height:42px; display:flex; align-items:center; justify-content:center; }
  .notification { width:42px !important; height:42px !important; }
  .notification-popover,.admin-dropdown { position:fixed !important; top:70px !important; right:12px !important; width:min(300px,calc(100vw - 24px)) !important; max-width:calc(100vw - 24px) !important; z-index:1200 !important; }
  .sub-menu { padding-left:34px; }
  .billing-machine { grid-template-columns:1fr !important; min-height:auto; }
  .billing-machine-screen { min-height:300px; }
  .billing-transfer-animation { left:18px; right:18px; bottom:16px; }
  .billing-machine-receipt { min-height:225px !important; padding:20px !important; }
  .receipt-printer { width:min(220px,80%); }
  .stats,.billing-stats,.report-grid,.customer-grid,.staff-grid,.two-column,.reports-chart-grid { grid-template-columns:1fr !important; }
  .page-title,.page-heading { flex-wrap:wrap; }
  .page-title button,.page-heading button,.jobs-new-button { width:100%; justify-content:center; }
  .table-card { overflow-x:auto; }
  .table-head,.table-row { min-width:760px; }
  .job-drawer { width:100% !important; }
}
@media (max-width:480px) {
  .content { padding-left:11px !important; padding-right:11px !important; }
  .global-search { max-width:38vw !important; }
  .global-search kbd { display:none; }
  .billing-machine-screen { padding:19px !important; }
  .billing-transfer-animation { gap:5px; }
  .bill-source { width:43px; flex-basis:43px; }
  .wave-track span { width:18px; height:18px; font-size:7px; }
  .printer-icon { width:37px; flex-basis:37px; }
}
@media (prefers-reduced-motion:reduce) {
  .billing-machine.is-printing .wave-track span,.billing-machine.is-printing .printer-icon,.billing-machine.is-printing .printed-paper,.content > * { animation:none !important; }
  .printed-paper { height:75px; padding:4px 10px; }
}
`;

const FINAL_CSS = CSS + AL_KANZ_FINAL_RESPONSIVE + AL_KANZ_FINAL_FIX;

export default App;