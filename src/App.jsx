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
  Sparkles,
  Download,
  SlidersHorizontal,
  RefreshCw,
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
      { name: "Billing", icon: Receipt, children: ["Main", "Transactions", "Invoices", "Payments"] },
      { name: "Quotations", icon: FileText, children: ["New Quotation", "All Quotations"] },
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

  const [openSections, setOpenSections] = useState(() => new Set(["Billing", "Quotations"]));

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("al-kanz-theme") || "day");
  const [modal, setModal] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [search, setSearch] = useState("");
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [entityPreview, setEntityPreview] = useState(null);
  const [quotations, setQuotations] = useState(() => safeParse(localStorage.getItem("al-kanz-quotations"), []));

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
        setTransactions((tx.data && tx.data.length) ? tx.data : (local.transactions || []));
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

  useEffect(() => {
    localStorage.setItem("al-kanz-quotations", JSON.stringify(quotations));
  }, [quotations]);

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
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter((job) =>
      [job.customer, job.item, job.work, job.id, job.phone]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [jobs, search]);

  const globalSearchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const results = [];
    const add = (type, label, meta, target, item) => {
      if (results.length >= 8) return;
      results.push({ type, label, meta, target, item });
    };
    jobs.forEach((x) => {
      if ([x.customer, x.item, x.work, x.id, x.phone].some(v => String(v || "").toLowerCase().includes(q)))
        add("Job", x.customer || "Job", `${x.id} · ${x.item || "Workshop item"}`, "Dashboard", x);
    });
    customers.forEach((x) => {
      if ([x.name, x.phone, x.location].some(v => String(v || "").toLowerCase().includes(q)))
        add("Customer", x.name, `${x.phone || "No phone"} · ${x.location || "Dubai"}`, "Customers", x);
    });
    quotations.forEach((x) => {
      if ([x.id, x.customer, x.item].some(v => String(v || "").toLowerCase().includes(q)))
        add("Quotation", x.id, `${x.customer} · ${money(x.amount)}`, "All Quotations", x);
    });
    transactions.forEach((x) => {
      if ([x.description, x.transaction_type, x.account].some(v => String(v || "").toLowerCase().includes(q)))
        add("Transaction", x.description || "Transaction", `${x.transaction_type || "Income"} · ${money(x.amount)}`, "Transactions", x);
    });
    return results;
  }, [search, jobs, customers, quotations, transactions]);

  return (
    <>
      <style>{FINAL_CSS}</style>

      <div className={`app theme-${theme} ${theme === "night" ? "theme-dark" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""}`} data-theme={theme}>
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

            <button type="button" className="logout" onClick={() => { setAdminMenuOpen(false); setSidebarOpen(false); alert("Demo mode: logout is not connected to authentication yet."); }}>
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
              <div className="global-search-wrap">
                <div className="global-search">
                  <Search size={16} />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customers, quotations, transactions..."
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setSearch("");
                      if (e.key === "Enter" && globalSearchResults[0]) {
                        navigate(globalSearchResults[0].target);
                        setSearch("");
                      }
                    }}
                  />
                  {search && <button type="button" className="search-clear" onClick={() => setSearch("")} aria-label="Clear search"><X size={13}/></button>}
                  <kbd>⌘ K</kbd>
                </div>
                {search && (
                  <div className="global-search-results">
                    <div className="search-results-head"><span>SMART SEARCH</span><small>{globalSearchResults.length} result{globalSearchResults.length === 1 ? "" : "s"}</small></div>
                    {globalSearchResults.length ? globalSearchResults.map((r, i) => (
                      <button type="button" className="search-result" key={`${r.type}-${i}`} onClick={() => { navigate(r.target); setSearch(""); }}>
                        <span className="search-result-icon">{r.type === "Customer" ? <Users size={14}/> : r.type === "Quotation" ? <FileText size={14}/> : r.type === "Transaction" ? <ReceiptText size={14}/> : <ClipboardList size={14}/>}</span>
                        <span><strong>{r.label}</strong><small>{r.type} · {r.meta}</small></span>
                        <ChevronRight size={14}/>
                      </button>
                    )) : <div className="search-empty"><Search size={18}/><strong>No matching records</strong><span>Try a customer, quotation number or transaction.</span></div>}
                  </div>
                )}
              </div>

              <button type="button" className={`ai-help-button ${aiOpen ? "active" : ""}`} onClick={() => { setAiOpen(v => !v); setAdminMenuOpen(false); setNotificationOpen(false); }} title="AI Help">
                <Sparkles size={16}/> <span>AI Help</span>
              </button>

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

          {aiOpen && (
            <AIHelpPanel
              page={page}
              totalPaid={totalPaid}
              outstanding={outstanding}
              expenses={expenses}
              quotations={quotations}
              navigate={(target) => { setAiOpen(false); navigate(target); }}
              close={() => setAiOpen(false)}
            />
          )}

          <div className="content page-motion" key={page} data-page={page}>
            {page === "Dashboard" && (
              <Dashboard
                totalSales={totalSales}
                outstanding={outstanding}
                totalPaid={totalPaid}
                totalExpenses={totalExpenses}
                transactions={transactions}
                quotations={quotations}
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
                setEntityPreview={setEntityPreview}
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
              <SuppliersPage suppliers={suppliers} setSuppliers={setSuppliers} setModal={setModal} setEntityPreview={setEntityPreview} />
            )}

            {page === "Staff" && (
              <StaffPage staff={staff} setStaff={setStaff} setModal={setModal} setEntityPreview={setEntityPreview} />
            )}

            {(page === "New Quotation" || page === "All Quotations" || page === "Quotations") && (
              <QuotationPage
                page={page}
                quotations={quotations}
                setQuotations={setQuotations}
                jobs={jobs}
              />
            )}

            {(page === "Billing" ||
              page === "Main" ||
              page === "Transactions" ||
              page === "Invoices" ||
              page === "Payments") && (
              <BillingPage
                page={page}
                jobs={jobs}
                payments={payments}
                transactions={transactions}
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
                navigate={navigate}
              />
            )}

            {(page === "Settings" ||
              page === "User" ||
              page === "Audit & Security") && (
              <SettingsPage page={page} theme={theme} setTheme={setTheme} />
            )}
          </div>
        </main>

        {entityPreview && (
          <EntityPreviewModal entity={entityPreview} close={() => setEntityPreview(null)} />
        )}

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
  outstanding,
  totalPaid,
  totalExpenses = 0,
  transactions = [],
  quotations = [],
  jobs = [],
  navigate,
  setModal,
}) {
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeQuotations = Array.isArray(quotations) ? quotations : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const invoiceCount = safeJobs.length;
  const quotationCount = safeQuotations.length;
  const collectionRate = totalSales > 0 ? Math.min(100, (totalPaid / totalSales) * 100) : 0;

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DUBAI WORKSHOP · BILLING</span>
          <h1>Good evening, Al Kanz.</h1>
          <p>Your billing, payments and financial activity at a glance.</p>
        </div>
        <button className="primary-button" onClick={() => navigate("New Quotation")}>
          <Plus size={17} />
          New Quotation
        </button>
      </div>

      <div className="hero">
        <div className="hero-text">
          <span>AL KANZ BILLING SYSTEM</span>
          <h2>Control every bill.<br />Track every payment.</h2>
          <p>Manage customers, quotations, invoices, payments, expenses and financial reports from one place.</p>
          <div className="hero-actions">
            <button onClick={() => navigate("Billing")}><Receipt size={15} /> Open billing</button>
            <button onClick={() => navigate("Reports")}>View reports <ArrowUpRight size={14} /></button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-ring ring-one" />
          <div className="hero-ring ring-two" />
          <div className="hero-sofa"><ReceiptText size={67} /></div>
          <div className="floating-icon icon-a"><FileText size={19} /></div>
          <div className="floating-icon icon-b"><CreditCard size={19} /></div>
          <div className="floating-icon icon-c"><Banknote size={19} /></div>
        </div>
      </div>

      <div className="stats">
        <Stat icon={FileText} label="Invoices" value={invoiceCount} note="billing records" color="blue" />
        <Stat icon={FileText} label="Quotations" value={quotationCount} note="customer estimates" color="green" />
        <Stat icon={CircleDollarSign} label="Outstanding" value={money(outstanding)} note="pending collection" color="orange" />
        <Stat icon={Banknote} label="Collected" value={money(totalPaid)} note="payments received" color="purple" />
      </div>

      <div className="two-column">
        <div className="card">
          <CardHeader eyebrow="BILLING" title="Payment overview" subtitle="Current collection performance" action="Open billing" onAction={() => navigate("Billing")} />
          <div className="finance-number"><span>Collected</span><strong>{money(totalPaid)}</strong></div>
          <div className="large-progress"><span style={{ width: `${collectionRate}%` }} /></div>
          <div className="finance-meta"><span>{Math.round(collectionRate)}% collected</span><strong>{money(outstanding)} pending</strong></div>
          <div className="recent-payments">
            <Payment name="Ahmed Rahman" amount="AED 10,000" time="10 min ago" />
            <Payment name="Faris Traders" amount="AED 5,000" time="1 hour ago" />
            <Payment name="Sameer Khan" amount="AED 8,000" time="2 hours ago" />
          </div>
        </div>

        <div className="card">
          <CardHeader eyebrow="QUICK ACTIONS" title="Billing shortcuts" subtitle="Common finance tasks" />
          <div className="quick-actions">
            <QuickAction icon={FileText} title="New Quotation" subtitle="Prepare a customer estimate" onClick={() => navigate("New Quotation")} />
            <QuickAction icon={Receipt} title="Invoices" subtitle="View customer invoices" onClick={() => navigate("Invoices")} />
            <QuickAction icon={CreditCard} title="Record Payment" subtitle="Record a customer payment" onClick={() => navigate("Payments")} />
            <QuickAction icon={Wallet} title="Expenses" subtitle="Track daily workshop expenses" onClick={() => navigate("Expenses")} />
          </div>
        </div>
      </div>

      <div className="two-column">
        <div className="card">
          <CardHeader eyebrow="RECENT ACTIVITY" title="Transactions" subtitle="Latest financial movements" action="View all" onAction={() => navigate("Transactions")} />
          <div className="job-list">
            {safeTransactions.slice(0, 4).map((tx, index) => (
              <div className="table-row" key={tx.id || index}>
                <strong>{tx.transaction_type || "Transaction"}</strong>
                <span>{tx.description || "Financial transaction"}</span>
                <strong className={String(tx.transaction_type).toLowerCase() === "expense" ? "expense" : "income"}>{money(tx.amount)}</strong>
              </div>
            ))}
            {!safeTransactions.length && <EmptyState icon={Receipt} title="No transactions yet" text="Recorded payments and expenses will appear here." />}
          </div>
        </div>

        <div className="card">
          <CardHeader eyebrow="FINANCE" title="Daily expense snapshot" subtitle="Keep spending visible" action="View accounts" onAction={() => navigate("Accounts")} />
          <div className="finance-number"><span>Total expenses</span><strong>{money(totalExpenses)}</strong></div>
          <div className="billing-summary-list">
            <div><span>Invoices</span><strong>{invoiceCount}</strong></div>
            <div><span>Quotations</span><strong>{quotationCount}</strong></div>
            <div><span>Collected</span><strong>{money(totalPaid)}</strong></div>
            <div><span>Outstanding</span><strong>{money(outstanding)}</strong></div>
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
  setEntityPreview,
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

              <div className="card-actions">
                <button type="button" className="row-action" onClick={() => setEntityPreview?.({ type: "Customer", ...customer })} title="View customer">
                  <Eye size={16} />
                </button>
                <button type="button" className="dots" onClick={() => setEntityPreview?.({ type: "Customer", ...customer })} title="Customer options">
                  <MoreHorizontal size={17} />
                </button>
              </div>
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

function SuppliersPage({ suppliers, setSuppliers, setModal, setEntityPreview }) {
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
            <button className="row-action" type="button" onClick={() => setEntityPreview?.({ type: "Supplier", ...supplier })} title="View supplier">
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

function StaffPage({ staff, setStaff, setModal, setEntityPreview }) {
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
            <div className="staff-card-footer">
              <label className={person.status === "Active" ? "staff-active" : "staff-leave"}>{person.status}</label>
              <button type="button" className="row-action" onClick={() => setEntityPreview?.({ type: "Staff", ...person })} title="View staff member"><Eye size={15}/></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================================================
   BILLING
============================================================ */

function BillingPage({ page, jobs, payments = [], transactions = [], outstanding, totalPaid, recordPayment }) {
  // Defensive normalization: Appwrite/localStorage can briefly return null or a non-array
  // while data is loading. The billing UI must still render instead of becoming blank.
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safePayments = Array.isArray(payments) ? payments : [];
  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  const invoices = safeJobs.map((job) => ({
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
      <div className="billing-action-strip">
        <div><span>PRINT CENTER</span><strong>Separate document controls</strong><small>Print invoices and customer receipts independently.</small></div>
        <div><button type="button" className="secondary-button" onClick={()=>window.print()}><Printer size={14}/> Print current view</button><button type="button" className="secondary-button" onClick={()=>window.print()}><ReceiptText size={14}/> Print receipt</button></div>
      </div>

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
            <div className="billing-flow" aria-hidden="true">
              <div className="billing-flow-step active">
                <div className="flow-icon"><FileText size={18}/></div>
                <span>1 · BILL CREATED</span>
              </div>
              <div className="billing-flow-line"><i/><i/><i/></div>
              <div className="billing-flow-step">
                <div className="flow-icon printer"><Printer size={19}/></div>
                <span>2 · SEND TO PRINTER</span>
              </div>
              <div className="billing-flow-line"><i/><i/><i/></div>
              <div className="billing-flow-step">
                <div className="flow-icon paper"><ReceiptText size={18}/></div>
                <span>3 · RECEIPT READY</span>
              </div>
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
        <div className="table-card billing-transactions-card">
          <div className="transactions-title-row">
            <div>
              <span className="eyebrow">LEDGER</span>
              <h2>All Transactions</h2>
              <p>Income, expenses and transfers recorded by the workshop.</p>
            </div>
            <span className="transaction-count">{safeTransactions.length || safePayments.length} records</span>
          </div>
          <div className="table-head transaction-head"><span>DATE</span><span>DESCRIPTION</span><span>TYPE</span><span>ACCOUNT</span><span>AMOUNT</span></div>
          {(safeTransactions.length ? transactions : safePayments.map((pay, i) => ({
            id: pay.id || `payment-${i}`,
            transaction_date: pay.paid_at,
            description: pay.notes || `Payment · ${pay.customer || "Customer"}`,
            transaction_type: "Income",
            account: pay.payment_method || "Cash",
            amount: pay.amount
          }))).length ? (safeTransactions.length ? transactions : safePayments.map((pay, i) => ({
            id: pay.id || `payment-${i}`, transaction_date: pay.paid_at, description: pay.notes || `Payment · ${pay.customer || "Customer"}`, transaction_type: "Income", account: pay.payment_method || "Cash", amount: pay.amount
          }))).map((tx, i) => (
            <div className="table-row transaction-row" key={tx.id || i}>
              <span>{tx.transaction_date ? new Date(tx.transaction_date).toLocaleDateString("en-AE") : "—"}</span>
              <strong>{tx.description || "Workshop transaction"}</strong>
              <Status status={tx.transaction_type || "Income"} />
              <span>{tx.account || "Cash"}</span>
              <strong className={tx.transaction_type === "Expense" ? "expense" : "income"}>
                {tx.transaction_type === "Expense" ? "-" : "+"}{money(tx.amount)}
              </strong>
            </div>
          )) : <EmptyState icon={ReceiptText} title="No transactions yet" text="Customer payments, expenses and transfers will appear here." />}
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
          {safePayments.length ? safePayments.map((pay, i) => (
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
        eyebrow="FINANCE · ANALYTICS"
        title="Reports & Insights"
        subtitle="Understand revenue, collections, expenses and financial movement."
      />
      <div className="report-toolbar">
        <div><span>LIVE DATA</span><strong>Financial overview</strong><small>Generated from current billing and account records.</small></div>
        <div className="report-toolbar-actions">
          <button type="button" className="secondary-button" onClick={() => window.print()}><Printer size={15}/> Print Report</button>
          <button type="button" className="secondary-button" onClick={() => { const rows=["Metric,Amount","Total Revenue,"+total,"Payments Collected,"+totalPaid,"Outstanding,"+outstanding,"Expenses,"+totalExpenses,"Net Cash Movement,"+netCash].join("\n"); const blob=new Blob([rows],{type:"text/csv"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="al-kanz-report.csv"; a.click(); URL.revokeObjectURL(a.href); }}><Download size={15}/> Export CSV</button>
        </div>
      </div>

      <div className="report-grid">
        <ReportBox icon={TrendingUp} title="Total Revenue" value={money(total)} note="Total value of workshop jobs" />
        <ReportBox icon={CircleDollarSign} title="Payments Collected" value={money(totalPaid)} note="Customer payments received" />
        <ReportBox icon={AlertCircle} title="Outstanding" value={money(outstanding)} note="Still to be collected" />
        <ReportBox icon={Wallet} title="Expenses" value={money(totalExpenses)} note="Workshop costs recorded" />
        <ReportBox icon={TrendingUp} title="Net Cash Movement" value={money(netCash)} note="Payments less expenses" />
        <ReportBox icon={CheckCircle2} title="Billing Records" value={jobs.length} note="Records available for invoicing" />
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

function AccountsPage({ page, totalPaid, outstanding, expenses = [], setExpenses, transfers = [], setTransfers, transactions = [], setTransactions, jobs = [], navigate }) {
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
        {['Accounts','Ledger','Expenses','Move Money'].map(x=><button type="button" key={x} className={page===x?'active':''} onClick={()=>navigate?.(x)}>{x}</button>)}
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
  const [activeTab, setActiveTab] = useState(page === "Audit & Security" ? "audit" : "profile");
  const [profile, setProfile] = useState(() => safeParse(localStorage.getItem("al-kanz-profile"), {
    name: "Al Kanz Admin", email: "admin@alkanzupholstery.com", phone: "+971 50 000 0000", role: "Owner"
  }));
  const [workshop, setWorkshop] = useState(() => safeParse(localStorage.getItem("al-kanz-workshop"), {
    name: "Al Kanz Upholstery", location: "Dubai, UAE", phone: "+971 50 000 0000", email: "admin@alkanzupholstery.com"
  }));
  const [notifications, setNotifications] = useState(() => safeParse(localStorage.getItem("al-kanz-notifications"), {
    jobs: true, payments: true, stock: true, daily: false
  }));
  const [message, setMessage] = useState("");

  const save = (key, value, text) => {
    localStorage.setItem(key, JSON.stringify(value));
    setMessage(text);
    window.setTimeout(() => setMessage(""), 1800);
  };

  const tabs = [
    ["profile", "User Profile", UserCog],
    ["workshop", "Workshop Settings", Settings],
    ["notifications", "Notifications", Bell],
    ["security", "Security", ShieldCheck],
    ["password", "Password", Lock],
    ["audit", "Audit & Security", ShieldCheck],
  ];

  return <>
    <PageTitle eyebrow="SYSTEM" title={page} subtitle="Manage your workshop account, security and preferences." />
    <div className="settings-layout">
      <div className="settings-menu">
        {tabs.map(([id,label,Icon]) => <button type="button" key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}><Icon size={17}/><span>{label}</span></button>)}
      </div>

      {activeTab === "profile" && <div className="card settings-card">
        <CardHeader eyebrow="PROFILE" title="User information" subtitle="Update your administrator details." />
        <div className="settings-form">
          <label>Full name<input value={profile.name} onChange={e=>setProfile({...profile,name:e.target.value})}/></label>
          <label>Email<input type="email" value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></label>
          <label>Phone<input value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label>
          <label>Role<input value={profile.role} readOnly/></label>
          <div className="settings-form-actions"><button type="button" className="primary-button" onClick={()=>save("al-kanz-profile",profile,"Profile saved successfully")}><Save size={16}/>Save Changes</button></div>
        </div>
      </div>}

      {activeTab === "workshop" && <div className="card settings-card">
        <CardHeader eyebrow="WORKSHOP" title="Workshop Settings" subtitle="Manage your workshop information." />
        <div className="settings-form">
          <label>Workshop Name<input value={workshop.name} onChange={e=>setWorkshop({...workshop,name:e.target.value})}/></label>
          <label>Location<input value={workshop.location} onChange={e=>setWorkshop({...workshop,location:e.target.value})}/></label>
          <label>Phone<input value={workshop.phone} onChange={e=>setWorkshop({...workshop,phone:e.target.value})}/></label>
          <label>Email<input value={workshop.email} onChange={e=>setWorkshop({...workshop,email:e.target.value})}/></label>
          <label>Currency<input value="AED — UAE Dirham" readOnly/></label>
          <label>Time Zone<input value="Asia/Dubai — GMT+4" readOnly/></label>
          <div className="settings-form-actions"><button type="button" className="primary-button" onClick={()=>save("al-kanz-workshop",workshop,"Workshop settings saved")}><Save size={16}/>Save Workshop Settings</button></div>
        </div>
      </div>}

      {activeTab === "notifications" && <div className="card settings-card">
        <CardHeader eyebrow="UPDATES" title="Notifications" subtitle="Choose which workshop notifications you receive." />
        <div className="settings-options">
          <NotificationSetting title="Job Updates" description="Notify me when repair jobs change status." checked={notifications.jobs} onChange={()=>{const n={...notifications,jobs:!notifications.jobs};setNotifications(n);save("al-kanz-notifications",n,"Notification settings updated")}}/>
          <NotificationSetting title="Payment Alerts" description="Notify me when customer payments are recorded." checked={notifications.payments} onChange={()=>{const n={...notifications,payments:!notifications.payments};setNotifications(n);save("al-kanz-notifications",n,"Notification settings updated")}}/>
          <NotificationSetting title="Low Stock Alerts" description="Notify me when workshop materials are running low." checked={notifications.stock} onChange={()=>{const n={...notifications,stock:!notifications.stock};setNotifications(n);save("al-kanz-notifications",n,"Notification settings updated")}}/>
          <NotificationSetting title="Daily Summary" description="Receive a daily workshop summary." checked={notifications.daily} onChange={()=>{const n={...notifications,daily:!notifications.daily};setNotifications(n);save("al-kanz-notifications",n,"Notification settings updated")}}/>
        </div>
      </div>}

      {activeTab === "security" && <div className="card settings-card">
        <CardHeader eyebrow="SECURITY" title="Account Security" subtitle="Protection settings for the administrator account." />
        <div className="settings-options">
          <div className="security-row"><div className="security-icon"><ShieldCheck size={20}/></div><div className="security-info"><strong>Account protection</strong><small>Administrator access is protected by the configured authentication system.</small></div><span className="security-status">Active</span></div>
          <div className="security-row"><div className="security-icon"><Lock size={20}/></div><div className="security-info"><strong>Session security</strong><small>Current browser session and access controls.</small></div><span className="security-status">Active</span></div>
        </div>
      </div>}

      {activeTab === "password" && <div className="card settings-card">
        <CardHeader eyebrow="ACCOUNT" title="Password" subtitle="Password changes should be handled by your authentication provider." />
        <div className="settings-form">
          <label>Current Password<input type="password" placeholder="Current password"/></label>
          <label>New Password<input type="password" placeholder="New password"/></label>
          <label>Confirm Password<input type="password" placeholder="Confirm password"/></label>
          <div className="settings-form-actions"><button type="button" className="primary-button" onClick={()=>alert("Connect this action to your Appwrite authentication password-update flow.")}><Lock size={16}/>Update Password</button></div>
        </div>
      </div>}

      {activeTab === "audit" && <div className="card settings-card">
        <CardHeader eyebrow="AUDIT & SECURITY" title="Activity & security log" subtitle="Review important actions performed in the workshop system." />
        <div className="settings-options">
          <div className="security-row"><div className="security-icon"><ShieldCheck size={20}/></div><div className="security-info"><strong>Audit trail</strong><small>Records actions such as creating jobs, customers, suppliers, staff and recording payments.</small></div><span className="security-status">Logging</span></div>
          <div className="audit-demo-list"><div><strong>What is the difference?</strong><p><b>Security</b> protects the account and controls access. <b>Audit & Security</b> records and reviews who did what and when, so activity can be traced.</p></div></div>
        </div>
      </div>}

      {activeTab === "profile" && <div className="card appearance-card">
        <CardHeader eyebrow="APPEARANCE" title="Choose your workspace" subtitle="Switch between Day and Night. The choice is remembered on this device." />
        <div className="theme-options theme-options-two">
          {[
            ["day","Day","Bright Al Kanz workspace"],
            ["night","Night","Low-light dark workspace"],
          ].map(([t,label,desc])=><button type="button" key={t} className={`theme-option ${theme===t?"active":""}`} onClick={()=>setTheme(t)}><span className={`theme-preview theme-preview-${t}`}/><div><strong>{label}</strong><small>{desc}</small></div>{theme===t&&<CheckCircle2 size={17}/>}</button>)}
        </div>
      </div>}
    </div>
    {message && <div className="settings-save-message"><CheckCircle2 size={16}/>{message}</div>}
  </>;
}

function NotificationSetting({ title, description, checked, onChange }) {
  return <button type="button" className="notification-setting" onClick={onChange}>
    <div className="notification-setting-info"><strong>{title}</strong><small>{description}</small></div>
    <span className={`toggle ${checked ? "on" : ""}`}><span/></span>
  </button>;
}

function QuotationPage({ page, quotations = [], setQuotations }) {
  const [form, setForm] = useState({
    customer: "",
    phone: "",
    item: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    validity: "30 days",
  });
  const [showForm, setShowForm] = useState(page === "New Quotation");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [aiText, setAiText] = useState("");

  const safeQuotations = Array.isArray(quotations) ? quotations : [];
  const subtotal = Number(form.quantity || 0) * Number(form.unitPrice || 0);
  const vat = subtotal * 0.05;
  const grandTotal = subtotal + vat;

  const runQuotationAI = () => {
    const item = form.item || "your upholstery service";
    const customer = form.customer || "the customer";
    const tips = [
      `Suggested scope: Inspect ${item}, confirm material/colour, complete the upholstery work, quality-check the finish and hand over after approval.`,
      `Pricing tip: keep the quotation itemized and show labour, materials, VAT and the final total separately.`,
      `Customer note: ${customer} should approve the quotation before the work is converted into an invoice.`,
    ];
    setAiText(tips.join(" "));
  };

  const save = () => {
    if (!form.customer || !form.item || !form.unitPrice) {
      alert("Customer, item and unit price are required.");
      return;
    }
    const q = {
      id: `QT-${String(Date.now()).slice(-6)}`,
      ...form,
      quantity: Number(form.quantity || 1),
      unitPrice: Number(form.unitPrice || 0),
      subtotal,
      vat,
      amount: grandTotal,
      status: "Draft",
      date: new Date().toLocaleDateString("en-AE"),
    };
    setQuotations(prev => [q, ...(Array.isArray(prev) ? prev : [])]);
    setSelectedQuote(q);
    setForm({ customer:"", phone:"", item:"", description:"", quantity:"1", unitPrice:"", validity:"30 days" });
    setShowForm(false);
  };

  return (
    <>
      <PageTitle
        eyebrow="SALES · UAE"
        title={page === "New Quotation" ? "New Quotation" : "Quotations"}
        subtitle="Create professional quotations using the same clean document structure as an invoice."
        button={!showForm ? "New Quotation" : null}
        onClick={() => setShowForm(true)}
      />

      {showForm && (
        <div className="quotation-invoice-layout">
          <div className="card quotation-form-card">
            <CardHeader eyebrow="QUOTATION DETAILS" title="Create quotation" subtitle="Demo quotation — prices can be edited before saving." />
            <div className="settings-form">
              <label>Customer<input value={form.customer} onChange={e=>setForm({...form,customer:e.target.value})} placeholder="Customer name" /></label>
              <label>Phone<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+971..." /></label>
              <label>Item / Service<input value={form.item} onChange={e=>setForm({...form,item:e.target.value})} placeholder="Sofa upholstery, car seat, etc." /></label>
              <label>Quantity<input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} /></label>
              <label>Unit Price (AED)<input type="number" min="0" value={form.unitPrice} onChange={e=>setForm({...form,unitPrice:e.target.value})} placeholder="0.00" /></label>
              <label>Validity<select value={form.validity} onChange={e=>setForm({...form,validity:e.target.value})}><option>7 days</option><option>15 days</option><option>30 days</option><option>60 days</option></select></label>
              <label className="full-field">Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Work included, materials, terms..." rows="4" /></label>
              <div className="quotation-ai-box full-field">
                <div><Sparkles size={17}/><div><strong>AI quotation helper</strong><small>Generate a professional scope and pricing reminder from your form.</small></div></div>
                <button type="button" className="secondary-button" onClick={runQuotationAI}><Sparkles size={15}/> Help me</button>
                {aiText && <p>{aiText}</p>}
              </div>
              <div className="settings-form-actions full-field quotation-action-bar"><button type="button" className="primary-button" onClick={save}><Save size={16}/> Save Quotation</button><button type="button" className="secondary-button" onClick={()=>setPrintOpen(true)}><Printer size={16}/> Print Options</button><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancel</button></div>
            </div>
          </div>

          <div className="card quotation-document">
            <div className="invoice-document-head">
              <div><span className="eyebrow">AL KANZ UPHOLSTERY</span><h2>QUOTATION</h2><p>Dubai, UAE · AED</p></div>
              <div className="document-number"><strong>QT-PREVIEW</strong><span>Date: {new Date().toLocaleDateString("en-AE")}</span><span>Valid: {form.validity}</span></div>
            </div>
            <div className="document-parties"><div><small>FROM</small><strong>Al Kanz Upholstery</strong><span>Dubai, UAE</span></div><div><small>TO</small><strong>{form.customer || "Customer Name"}</strong><span>{form.phone || "Customer phone"}</span></div></div>
            <div className="invoice-items">
              <div className="invoice-item-head"><span>DESCRIPTION</span><span>QTY</span><span>UNIT PRICE</span><span>TOTAL</span></div>
              <div className="invoice-item-row"><span><strong>{form.item || "Item / Service"}</strong><small>{form.description || "Description of proposed work"}</small></span><span>{form.quantity || 1}</span><span>{money(form.unitPrice)}</span><strong>{money(subtotal)}</strong></div>
            </div>
            <div className="document-totals"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>VAT (5%)</span><strong>{money(vat)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(grandTotal)}</strong></div></div>
            <div className="document-note"><strong>Quotation terms</strong><span>This quotation is a demo estimate and is valid for {form.validity}. Final billing may vary based on approved work or materials.</span></div>
          </div>
        </div>
      )}

      {!showForm && (
        <div className="table-card">
          <div className="table-head"><span>QUOTE</span><span>CUSTOMER</span><span>ITEM</span><span>AMOUNT</span><span>STATUS</span></div>
          {safeQuotations.length === 0 ? <EmptyState icon={FileText} title="No quotations yet" text="Create your first quotation." /> : safeQuotations.map(q => (
            <button type="button" className="table-row quotation-row-button" key={q.id} onClick={()=>setSelectedQuote(q)}>
              <strong>{q.id}</strong><span>{q.customer}</span><span>{q.item}</span><strong>{money(q.amount)}</strong><Status status={q.status}/>
            </button>
          ))}
        </div>
      )}

      {selectedQuote && (
        <div className="modal-backdrop">
          <div className="card quotation-document quotation-modal-document">
            <button className="job-drawer-close" style={{position:"absolute",right:18,top:18}} onClick={()=>setSelectedQuote(null)}><X size={20}/></button>
            <div className="invoice-document-head"><div><span className="eyebrow">AL KANZ UPHOLSTERY</span><h2>QUOTATION</h2><p>Dubai, UAE · AED</p></div><div className="document-number"><strong>{selectedQuote.id}</strong><span>{selectedQuote.date}</span><span>Valid: {selectedQuote.validity}</span></div></div>
            <div className="document-parties"><div><small>FROM</small><strong>Al Kanz Upholstery</strong><span>Dubai, UAE</span></div><div><small>TO</small><strong>{selectedQuote.customer}</strong><span>{selectedQuote.phone || "—"}</span></div></div>
            <div className="invoice-items"><div className="invoice-item-head"><span>DESCRIPTION</span><span>QTY</span><span>UNIT PRICE</span><span>TOTAL</span></div><div className="invoice-item-row"><span><strong>{selectedQuote.item}</strong><small>{selectedQuote.description || "—"}</small></span><span>{selectedQuote.quantity}</span><span>{money(selectedQuote.unitPrice)}</span><strong>{money(selectedQuote.subtotal)}</strong></div></div>
            <div className="document-totals"><div><span>Subtotal</span><strong>{money(selectedQuote.subtotal)}</strong></div><div><span>VAT (5%)</span><strong>{money(selectedQuote.vat)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(selectedQuote.amount)}</strong></div></div>
            <div className="document-actions"><button className="primary-button" onClick={()=>window.print()}><Printer size={16}/> Print Quotation</button><button className="secondary-button" onClick={()=>setPrintOpen(true)}><SlidersHorizontal size={16}/> Print Options</button><button className="secondary-button" onClick={()=>{ const copy={...selectedQuote,id:`QT-${String(Date.now()).slice(-6)}`,status:"Draft",date:new Date().toLocaleDateString("en-AE")}; setQuotations(prev=>[copy,...prev]); setSelectedQuote(copy); }}><RefreshCw size={16}/> Duplicate</button><button className="secondary-button" onClick={()=>{ setSelectedQuote(null); setShowForm(true); setForm({customer:selectedQuote.customer,phone:selectedQuote.phone||"",item:selectedQuote.item,description:selectedQuote.description||"",quantity:String(selectedQuote.quantity||1),unitPrice:String(selectedQuote.unitPrice||0),validity:selectedQuote.validity||"30 days"}); }}> <Edit3 size={16}/> Edit</button><button className="secondary-button" onClick={()=>setSelectedQuote(null)}>Close</button></div>
          </div>
        </div>
      )}

      {printOpen && (
        <PrintOptionsModal
          title="Quotation printing"
          close={() => setPrintOpen(false)}
          options={[
            ["Print quotation", "Clean customer-facing quotation", () => window.print()],
            ["Print customer copy", "Print another copy for the customer file", () => window.print()],
            ["Print internal copy", "Print a copy for workshop records", () => window.print()],
          ]}
        />
      )}
    </>
  );
}

/* ============================================================
   SMART SEARCH / AI / PREVIEW / PRINT HELPERS
============================================================ */

function AIHelpPanel({ page, totalPaid, outstanding, expenses = [], quotations = [], navigate, close }) {
  const tips = page === "Billing" || page === "Transactions" || page === "Invoices" || page === "Payments"
    ? [
        ["Review outstanding", `There is ${money(outstanding)} still pending. Open Billing to review invoices.`, "Billing"],
        ["Check transactions", "Review income, expenses and transfers in one ledger.", "Transactions"],
        ["Record a payment", "Keep customer balances synchronized after every payment.", "Payments"],
      ]
    : page === "Reports"
      ? [
          ["Analyze expenses", `Current recorded expenses are ${money(expenses.reduce((a,b)=>a+Number(b.amount||0),0))}.`, "Expenses"],
          ["Check collections", `Customer collections currently total ${money(totalPaid)}.`, "Billing"],
          ["Export report", "Use Export CSV or Print Report from the Reports toolbar.", "Reports"],
        ]
      : [
          ["Create a quotation", "Prepare an invoice-style estimate with VAT, validity and customer details.", "New Quotation"],
          ["Review quotations", `${quotations.length} quotation${quotations.length===1?"":"s"} are saved on this device.`, "All Quotations"],
          ["Open dashboard", "See collection, outstanding balances and financial activity at a glance.", "Dashboard"],
        ];
  return <div className="ai-panel">
    <div className="ai-panel-head"><div><span><Sparkles size={14}/> AI WORKSPACE HELP</span><h3>Smart next steps</h3><p>Automated guidance based on the current screen and saved records.</p></div><button type="button" onClick={close}><X size={16}/></button></div>
    <div className="ai-suggestions">{tips.map(([title,text,target],i)=><button type="button" key={title} onClick={()=>navigate(target)}><span className="ai-suggestion-number">0{i+1}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={15}/></button>)}</div>
  </div>;
}

function EntityPreviewModal({ entity, close }) {
  const fields = Object.entries(entity || {}).filter(([k,v]) => !["type","id","$id","$createdAt","$updatedAt"].includes(k) && v !== undefined && v !== null && typeof v !== "object");
  return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)close();}}>
    <div className="card entity-preview-modal">
      <button type="button" className="modal-close" onClick={close} aria-label="Close"><X size={17}/></button>
      <span className="eyebrow">{entity.type || "RECORD"}</span>
      <h2>{entity.name || entity.customer || entity.id || "Record details"}</h2>
      <p className="entity-preview-subtitle">Read-only record preview. Changes can be made from the relevant section.</p>
      <div className="entity-preview-grid">{fields.map(([key,value])=><div key={key}><small>{key.replaceAll("_"," ").toUpperCase()}</small><strong>{String(value)}</strong></div>)}</div>
      <div className="document-actions"><button type="button" className="secondary-button" onClick={close}>Close</button></div>
    </div>
  </div>;
}

function PrintOptionsModal({ title, close, options = [] }) {
  return <div className="modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)close();}}>
    <div className="card print-options-modal">
      <button type="button" className="modal-close" onClick={close}><X size={17}/></button>
      <span className="eyebrow">PRINT CENTER</span><h2>{title}</h2><p>Choose exactly which document copy you want to send to the browser printer.</p>
      <div className="print-option-list">{options.map(([label,desc,action])=><button type="button" key={label} onClick={()=>{action();close();}}><span className="print-option-icon"><Printer size={17}/></span><span><strong>{label}</strong><small>{desc}</small></span><ArrowUpRight size={15}/></button>)}</div>
    </div>
  </div>;
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

const AL_KANZ_LAST_FIX = `
/* LAST UI FIXES */
.app.theme-dark, .app.theme-dark .main, .app.theme-dark .content { background:#0b1211; color:#edf5f2; }
.app.theme-dark .topbar { background:#101a18 !important; border-color:#263633 !important; }
.app.theme-dark .sidebar { background:#071512 !important; }
.app.theme-dark .settings-menu, .app.theme-dark .card, .app.theme-dark .table-card, .app.theme-dark .modal, .app.theme-dark .job-drawer, .app.theme-dark .jobs-modern-card, .app.theme-dark .appearance-card { background:#151f1d !important; border-color:#2b3a37 !important; color:#edf5f2 !important; }
.app.theme-dark input, .app.theme-dark select, .app.theme-dark textarea, .app.theme-dark .global-search, .app.theme-dark .jobs-search-modern, .app.theme-dark .jobs-status-filter { background:#0f1816 !important; color:#edf5f2 !important; border-color:#30413d !important; }
.app.theme-dark .settings-menu button { color:#aabcb7 !important; }
.app.theme-dark .settings-menu button.active, .app.theme-dark .settings-menu button:hover { background:#183b33 !important; color:#79d0b0 !important; }
.app.theme-dark .table-head, .app.theme-dark .table-row { border-color:#293936 !important; }
.app.theme-dark .table-row:hover { background:#172522 !important; }
.app.theme-dark .page-title h1, .app.theme-dark .page-heading h1, .app.theme-dark h1, .app.theme-dark h2, .app.theme-dark h3 { color:#edf5f2; }
.app.theme-dark .page-title p, .app.theme-dark .card-header p, .app.theme-dark small { color:#8fa39e; }
.settings-form-actions { grid-column:1 / -1; display:flex; gap:10px; }
.settings-options { padding:0 21px 25px; display:flex; flex-direction:column; gap:12px; }
.notification-setting { width:100%; border:1px solid var(--border); background:var(--white); color:var(--text); border-radius:12px; padding:15px; display:flex; align-items:center; justify-content:space-between; text-align:left; cursor:pointer; }
.notification-setting-info strong,.notification-setting-info small { display:block; }
.notification-setting-info small { margin-top:4px; color:var(--text-2); font-size:9px; }
.toggle { width:42px; height:24px; border-radius:99px; background:#ccd5d2; padding:3px; display:flex; align-items:center; }
.toggle span { width:18px; height:18px; border-radius:50%; background:#fff; transition:.2s; }
.toggle.on { background:var(--green); }.toggle.on span { transform:translateX(18px); }
.security-row { min-height:65px; padding:14px; border:1px solid var(--border); border-radius:12px; display:flex; align-items:center; gap:12px; background:var(--white); }
.security-icon { width:36px;height:36px;border-radius:9px;background:var(--green-light);color:var(--green);display:grid;place-items:center; }
.security-info { flex:1; }.security-info strong,.security-info small { display:block; }.security-info small { margin-top:4px;color:var(--text-2);font-size:9px; }.security-status { padding:5px 9px;border-radius:999px;background:var(--green-light);color:var(--green);font-size:8px;font-weight:800; }
.settings-save-message { position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;gap:8px;align-items:center;padding:11px 15px;border-radius:10px;background:var(--white);border:1px solid var(--border);color:var(--green);box-shadow:0 10px 30px rgba(0,0,0,.15); }
.billing-transfer-animation-v2 { margin-top:24px; display:grid; grid-template-columns:120px 1fr 100px; align-items:center; gap:16px; min-height:68px; }
.bill-source-v2,.printer-icon-v2 { display:flex;flex-direction:column;align-items:center;gap:6px;color:#fff;font-size:8px;font-weight:800;letter-spacing:1.3px; }
.data-stream-v2 { position:relative;height:38px;display:flex;align-items:center;justify-content:space-between; }
.data-stream-v2:before { content:"";position:absolute;left:0;right:0;height:2px;background:rgba(255,255,255,.18); }
.data-stream-v2 i { position:relative;width:8px;height:8px;border-radius:50%;background:#c5efdf;box-shadow:0 0 12px rgba(197,239,223,.6);animation:dataWave 1.35s ease-in-out infinite; }
.data-stream-v2 i:nth-child(2){animation-delay:.12s}.data-stream-v2 i:nth-child(3){animation-delay:.24s}.data-stream-v2 i:nth-child(4){animation-delay:.36s}.data-stream-v2 i:nth-child(5){animation-delay:.48s}.data-stream-v2 i:nth-child(6){animation-delay:.6s}
@keyframes dataWave {0%,100%{transform:translateY(9px);opacity:.35}50%{transform:translateY(-9px);opacity:1}}
.billing-machine.is-printing .data-stream-v2 i { animation-duration:.65s; }.billing-machine.is-printing .printer-icon-v2 svg { animation:printerPulse .5s infinite; }
@keyframes printerPulse {50%{transform:translateY(-2px) scale(1.07)}}
.billing-machine-receipt .printed-paper { transform:translateY(14px);opacity:.2; }.billing-machine.is-printing .printed-paper { animation:paperOut 2.6s cubic-bezier(.2,.8,.3,1) forwards; }
@keyframes paperOut {0%{transform:translateY(14px);opacity:.2}20%{opacity:1}100%{transform:translateY(-34px);opacity:1}}
.quotation-form-card{margin-bottom:18px}.empty-state{padding:45px 20px;text-align:center;color:var(--muted);font-size:11px}.secondary-button{height:38px;padding:0 14px;border-radius:9px;border:1px solid var(--border);background:var(--white);color:var(--text);font-weight:700;cursor:pointer}.audit-demo-list{padding:14px;border:1px solid var(--border);border-radius:12px;background:var(--soft)}.audit-demo-list p{color:var(--text-2);font-size:10px;line-height:1.6;margin:7px 0 0}
@media(max-width:700px){.billing-transfer-animation-v2{grid-template-columns:80px 1fr 75px;gap:8px}.settings-form{grid-template-columns:1fr}.settings-form-actions{grid-column:1}.security-row{align-items:flex-start}}
`;


const AL_KANZ_TRUE_FINAL_FIX = `
/* ============================================================
   TRUE FINAL FIX — TRANSACTIONS / DARK THEME / BILLING FLOW
   ============================================================ */

/* Transactions */
.billing-transactions-card { overflow:hidden; }
.transactions-title-row { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; padding:22px 24px 18px; border-bottom:1px solid var(--border); }
.transactions-title-row h2 { margin:4px 0 4px; color:var(--text); font-size:18px; }
.transactions-title-row p { margin:0; color:var(--text-2); font-size:10px; }
.transaction-count { padding:7px 10px; border-radius:999px; background:var(--green-light); color:var(--green); font-size:9px; font-weight:800; white-space:nowrap; }
.transaction-head,.transaction-row { grid-template-columns:1fr 2.2fr 1fr 1fr 1.1fr; min-width:650px; }
.transaction-row { min-height:58px; }
.transaction-row strong { color:var(--text); }
.transaction-row .income { color:#168061; }
.transaction-row .expense { color:#c45f55; }

/* Completely consistent dark workspace */
.app.theme-dark {
  --bg:#08110f;
  --white:#121d1a;
  --soft:#172420;
  --green:#73d4b2;
  --green-dark:#50b697;
  --green-light:#173b31;
  --sidebar:#061612;
  --sidebar-2:#0d3028;
  --sidebar-text:#c1d6d0;
  --text:#f0f7f4;
  --text-2:#b0c4be;
  --muted:#81958f;
  --border:#2b403a;
  --shadow:0 12px 35px rgba(0,0,0,.38);
  background:var(--bg) !important;
}
.app.theme-dark .main,
.app.theme-dark .content { background:var(--bg) !important; }
.app.theme-dark .topbar { background:#0d1815 !important; border-color:#263a35 !important; color:var(--text); }
.app.theme-dark .sidebar { background:linear-gradient(180deg,#061612,#081b17) !important; border-color:#1d302b !important; }
.app.theme-dark .brand strong,.app.theme-dark .brand span,.app.theme-dark .nav-section-title { color:var(--sidebar-text); }
.app.theme-dark .nav-item,.app.theme-dark .sub-menu button { color:#a9beb8 !important; }
.app.theme-dark .nav-item:hover,.app.theme-dark .sub-menu button:hover { background:#12332b !important; color:#e4f5ef !important; }
.app.theme-dark .nav-item.selected,.app.theme-dark .sub-menu button.sub-selected { background:#155143 !important; color:#e9fff7 !important; }
.app.theme-dark .card,.app.theme-dark .table-card,.app.theme-dark .jobs-modern-card,.app.theme-dark .settings-card,.app.theme-dark .appearance-card,.app.theme-dark .modal,.app.theme-dark .job-drawer { background:#121d1a !important; border-color:#2b403a !important; color:var(--text) !important; box-shadow:var(--shadow); }
.app.theme-dark .table-head { background:#0e1916 !important; color:#819b93 !important; border-color:#2a3d38 !important; }
.app.theme-dark .table-row { background:#121d1a !important; border-color:#263a35 !important; color:var(--text); }
.app.theme-dark .table-row:hover { background:#172823 !important; }
.app.theme-dark input,.app.theme-dark select,.app.theme-dark textarea,.app.theme-dark .field input,.app.theme-dark .field select,.app.theme-dark .settings-form input,.app.theme-dark .settings-form select,.app.theme-dark .settings-form textarea,.app.theme-dark .global-search,.app.theme-dark .jobs-search-modern,.app.theme-dark .jobs-status-filter { background:#0c1714 !important; border-color:#30453f !important; color:#eef7f3 !important; }
.app.theme-dark input::placeholder,.app.theme-dark textarea::placeholder { color:#6f837d !important; }
.app.theme-dark .settings-menu { background:#101b18 !important; border-color:#2b403a !important; }
.app.theme-dark .settings-menu button { color:#a9beb8 !important; }
.app.theme-dark .settings-menu button.active { background:#183c32 !important; color:#79d7b5 !important; }
.app.theme-dark .notification-setting,.app.theme-dark .security-row,.app.theme-dark .theme-option,.app.theme-dark .secondary-button { background:#0f1a17 !important; border-color:#2c403b !important; color:var(--text) !important; }
.app.theme-dark .notification-setting:hover,.app.theme-dark .theme-option:hover { background:#162822 !important; }
.app.theme-dark .admin-dropdown,.app.theme-dark .notification-popover { background:#111d1a !important; border-color:#2b403a !important; color:var(--text); box-shadow:0 20px 50px rgba(0,0,0,.5); }
.app.theme-dark .admin-dropdown > button,.app.theme-dark .notification-footer { color:#b9cbc6 !important; }
.app.theme-dark .admin-dropdown > button:hover,.app.theme-dark .notification-footer:hover { background:#193229 !important; color:#7ad5b4 !important; }
.app.theme-dark .admin-profile:hover,.app.theme-dark .admin-profile.admin-active { background:#183129 !important; }
.app.theme-dark .mobile-menu { background:#14241f !important; color:#c3d6d0 !important; }
.app.theme-dark .page-title h1,.app.theme-dark .page-heading h1,.app.theme-dark h1,.app.theme-dark h2,.app.theme-dark h3,.app.theme-dark strong { color:#eef7f3; }
.app.theme-dark .page-title p,.app.theme-dark .page-heading p,.app.theme-dark .card-header p,.app.theme-dark small { color:#91a69f; }

/* New billing animation: three calm physical steps */
.billing-flow { margin-top:24px; display:grid; grid-template-columns:112px 1fr 125px 1fr 112px; align-items:center; gap:10px; padding:12px 14px; border:1px solid rgba(255,255,255,.12); border-radius:14px; background:rgba(0,0,0,.10); }
.billing-flow-step { display:flex; flex-direction:column; align-items:center; gap:7px; color:#c8e1da; font-size:7px; font-weight:800; letter-spacing:.8px; text-align:center; }
.flow-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:10px; background:rgba(255,255,255,.10); border:1px solid rgba(255,255,255,.14); }
.flow-icon.printer { background:rgba(185,223,121,.13); color:#d8efb8; }
.flow-icon.paper { background:rgba(113,211,178,.13); color:#bcefe0; }
.billing-flow-line { height:2px; display:flex; align-items:center; gap:5px; overflow:hidden; }
.billing-flow-line:before { content:""; flex:1; height:1px; background:rgba(255,255,255,.20); }
.billing-flow-line i { width:5px; height:5px; border-radius:50%; background:#b9df79; animation:flowDot 1.7s ease-in-out infinite; opacity:.25; }
.billing-flow-line i:nth-child(2){animation-delay:.28s}.billing-flow-line i:nth-child(3){animation-delay:.56s}
@keyframes flowDot { 0%,100%{transform:scale(.7);opacity:.2} 50%{transform:scale(1.35);opacity:1} }
.billing-machine.is-printing .billing-flow-step:nth-child(1) .flow-icon { animation:flowConfirm .55s ease-out; }
.billing-machine.is-printing .billing-flow-step:nth-child(3) .flow-icon { animation:printerReceive .8s .65s ease-out both; }
.billing-machine.is-printing .billing-flow-step:nth-child(5) .flow-icon { animation:receiptReady .7s 1.25s ease-out both; }
@keyframes flowConfirm { 50%{transform:scale(1.08);box-shadow:0 0 0 7px rgba(185,223,121,.08)} }
@keyframes printerReceive { 50%{transform:translateY(-3px);box-shadow:0 8px 22px rgba(185,223,121,.16)} }
@keyframes receiptReady { 0%{transform:translateY(4px);opacity:.45} 100%{transform:translateY(0);opacity:1} }

/* Make the receipt physically emerge from the printer, not float */
.billing-machine-receipt .printed-paper { transform:translateY(-2px); opacity:.35; }
.billing-machine.is-printing .billing-machine-receipt .printed-paper { animation:cleanPaperFeed 2.2s cubic-bezier(.22,.75,.2,1) .55s both; }
@keyframes cleanPaperFeed { 0%{transform:translateY(-12px);opacity:.15} 18%{opacity:1} 60%{transform:translateY(8px)} 100%{transform:translateY(0);opacity:1} }
.billing-machine.is-printing .receipt-printer { animation:printerBody 1.1s ease-in-out .45s both; }
@keyframes printerBody { 40%{transform:translateY(-2px)} 70%{transform:translateY(1px)} }

@media(max-width:700px){
  .transactions-title-row { align-items:flex-start; flex-direction:column; }
  .billing-flow { grid-template-columns:1fr; gap:8px; padding:12px; }
  .billing-flow-line { height:18px; width:2px; margin:auto; flex-direction:column; }
  .billing-flow-line:before { width:1px; height:100%; flex:none; }
  .billing-flow-line i { display:none; }
}
@media(prefers-reduced-motion:reduce){
  .billing-flow-line i,.billing-machine.is-printing .billing-flow-step .flow-icon,.billing-machine.is-printing .billing-machine-receipt .printed-paper,.billing-machine.is-printing .receipt-printer { animation:none !important; }
}
`;



const AL_KANZ_FULL_MOTION_CSS = `
/* ============================================================
   AL KANZ — FULL MOTION SYSTEM
   ============================================================ */
.app{--motion-ease:cubic-bezier(.22,.8,.22,1);position:relative;isolation:isolate}
.app::before{content:"";position:fixed;inset:-20%;z-index:-2;pointer-events:none;background:radial-gradient(circle at 18% 18%,rgba(89,196,161,.075),transparent 24%),radial-gradient(circle at 82% 30%,rgba(183,222,116,.055),transparent 22%),radial-gradient(circle at 55% 88%,rgba(69,157,132,.045),transparent 25%);animation:ambientDrift 18s ease-in-out infinite alternate}
@keyframes ambientDrift{0%{transform:translate3d(-1.5%,-1%,0) scale(1)}50%{transform:translate3d(1.5%,1%,0) scale(1.025)}100%{transform:translate3d(-.5%,1.5%,0) scale(1.01)}}
.topbar{position:relative;z-index:30;transition:background .45s var(--motion-ease),box-shadow .45s var(--motion-ease),border-color .45s var(--motion-ease)}
.topbar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:1px;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,transparent,var(--green),transparent);animation:topbarSweep 1.1s var(--motion-ease) .1s both}
@keyframes topbarSweep{to{transform:scaleX(1)}}
.page-motion{animation:pageEnter .52s var(--motion-ease) both;transform-origin:50% 8%;position:relative}
@keyframes pageEnter{0%{opacity:0;transform:translateY(12px) scale(.992);filter:blur(3px)}55%{opacity:1;filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1)}}
.page-motion>*{animation:sectionRise .6s var(--motion-ease) both}.page-motion>*:nth-child(1){animation-delay:.04s}.page-motion>*:nth-child(2){animation-delay:.09s}.page-motion>*:nth-child(3){animation-delay:.14s}.page-motion>*:nth-child(4){animation-delay:.19s}.page-motion>*:nth-child(5){animation-delay:.24s}
@keyframes sectionRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
.sidebar{transition:width .38s var(--motion-ease),transform .38s var(--motion-ease),box-shadow .38s var(--motion-ease);will-change:width,transform}
.nav-group{animation:navGroupIn .65s var(--motion-ease) both}.nav-group:nth-child(1){animation-delay:.05s}.nav-group:nth-child(2){animation-delay:.1s}.nav-group:nth-child(3){animation-delay:.15s}.nav-group:nth-child(4){animation-delay:.2s}
@keyframes navGroupIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:none}}
.nav-item{position:relative;overflow:hidden;transition:transform .22s var(--motion-ease),background .22s ease,color .22s ease,padding .45s var(--motion-ease)}
.nav-item::before{content:"";position:absolute;top:0;bottom:0;left:0;width:3px;border-radius:0 5px 5px 0;background:var(--green);transform:scaleY(0);transform-origin:center;transition:transform .25s var(--motion-ease)}
.nav-item:hover{transform:translateX(3px)}.nav-item:hover::before,.nav-item.selected::before{transform:scaleY(1)}.nav-item svg{transition:transform .3s var(--motion-ease)}.nav-item:hover svg{transform:scale(1.08) rotate(-3deg)}
.sub-menu{animation:subMenuOpen .3s var(--motion-ease) both;transform-origin:top}@keyframes subMenuOpen{from{opacity:0;transform:scaleY(.82) translateY(-4px)}to{opacity:1;transform:scaleY(1) translateY(0)}}.sub-menu button{transition:transform .2s ease,color .2s ease,background .2s ease}.sub-menu button:hover{transform:translateX(4px)}
.primary-button,.secondary-button,.hero-actions button,.create-bill-button,.job-payment-button,.jobs-new-button,.filter-button,.text-button,.modal-footer button,.settings-form-actions button{position:relative;overflow:hidden;transition:transform .2s var(--motion-ease),box-shadow .25s var(--motion-ease),filter .2s ease}
.primary-button::after,.create-bill-button::after,.hero-actions button::after,.jobs-new-button::after{content:"";position:absolute;top:-60%;left:-80%;width:45%;height:220%;transform:rotate(18deg);background:linear-gradient(90deg,transparent,rgba(255,255,255,.24),transparent);transition:left .65s var(--motion-ease);pointer-events:none}.primary-button:hover,.create-bill-button:hover,.jobs-new-button:hover{transform:translateY(-2px);box-shadow:0 12px 25px rgba(14,92,76,.18)}.primary-button:hover::after,.create-bill-button:hover::after,.hero-actions button:hover::after,.jobs-new-button:hover::after{left:145%}.primary-button:active,.secondary-button:active,.hero-actions button:active,.create-bill-button:active,.jobs-new-button:active,.filter-button:active,.modal-footer button:active{transform:translateY(1px) scale(.985)}
.card,.stat-card,.chart-card,.report-card,.report-box,.reports-chart-card,.customer-card,.material-card,.staff-card,.jobs-modern-card,.table-card,.settings-card,.appearance-card,.account-big-card,.daily-expense-card,.quotation-form-card,.billing-transactions-card{transition:transform .35s var(--motion-ease),box-shadow .35s var(--motion-ease),border-color .35s ease}
.card:hover,.stat-card:hover,.chart-card:hover,.report-card:hover,.reports-chart-card:hover,.customer-card:hover,.material-card:hover,.staff-card:hover,.jobs-modern-card:hover,.table-card:hover,.settings-card:hover,.appearance-card:hover,.account-big-card:hover,.daily-expense-card:hover,.quotation-form-card:hover,.billing-transactions-card:hover{transform:translateY(-3px);box-shadow:0 16px 36px rgba(15,55,47,.10)}
.theme-dark .card:hover,.theme-dark .stat-card:hover,.theme-dark .chart-card:hover,.theme-dark .report-card:hover,.theme-dark .reports-chart-card:hover,.theme-dark .customer-card:hover,.theme-dark .material-card:hover,.theme-dark .staff-card:hover,.theme-dark .jobs-modern-card:hover,.theme-dark .table-card:hover,.theme-dark .settings-card:hover,.theme-dark .appearance-card:hover,.theme-dark .account-big-card:hover,.theme-dark .daily-expense-card:hover,.theme-dark .quotation-form-card:hover,.theme-dark .billing-transactions-card:hover{box-shadow:0 18px 42px rgba(0,0,0,.32)}
.stat-card strong,.billing-stats strong,.report-box strong{animation:numberReveal .65s var(--motion-ease) both}@keyframes numberReveal{from{opacity:0;transform:translateY(7px);filter:blur(2px)}to{opacity:1;transform:none;filter:none}}
.hero{position:relative;overflow:hidden}.hero::after{content:"";position:absolute;width:220px;height:220px;right:-80px;top:-100px;border:1px solid rgba(185,223,121,.20);border-radius:50%;animation:heroOrbit 8s linear infinite;pointer-events:none}@keyframes heroOrbit{to{transform:rotate(360deg) translateX(5px) rotate(-360deg)}}.hero-ring{animation:ringBreath 4s ease-in-out infinite}.ring-two{animation-delay:1s}@keyframes ringBreath{0%,100%{transform:scale(.98);opacity:.5}50%{transform:scale(1.03);opacity:.9}}.hero-sofa{animation:sofaFloat 3.8s ease-in-out infinite}@keyframes sofaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.global-search,.jobs-search-modern,.jobs-status-filter,input,select,textarea{transition:border-color .25s ease,box-shadow .25s ease,transform .2s ease,background .25s ease}.global-search:focus-within,.jobs-search-modern:focus-within{transform:translateY(-1px);box-shadow:0 0 0 3px rgba(72,166,139,.10)}input:focus,select:focus,textarea:focus{box-shadow:0 0 0 3px rgba(72,166,139,.10)}
.table-row,.transaction-row,.invoice-row{transition:background .22s ease,transform .22s var(--motion-ease),box-shadow .22s ease}.table-row:hover,.transaction-row:hover,.invoice-row:hover{transform:translateX(3px)}
.admin-dropdown,.notification-popover{animation:popoverIn .28s var(--motion-ease) both;transform-origin:top right}@keyframes popoverIn{from{opacity:0;transform:translateY(-7px) scale(.96)}to{opacity:1;transform:none}}.admin-profile div{transition:transform .3s var(--motion-ease),box-shadow .3s ease}.admin-profile:hover div{transform:rotate(-5deg) scale(1.06);box-shadow:0 5px 16px rgba(77,163,135,.18)}.notification.active svg{animation:bellMotion .65s ease both}@keyframes bellMotion{0%{transform:rotate(0)}20%{transform:rotate(13deg)}40%{transform:rotate(-12deg)}60%{transform:rotate(8deg)}80%{transform:rotate(-5deg)}100%{transform:rotate(0)}}.notification i{animation:notificationPulse 2s ease-in-out infinite}@keyframes notificationPulse{0%,100%{transform:scale(.85);opacity:.65}50%{transform:scale(1.25);opacity:1}}
.modal-backdrop,.modal-overlay{animation:backdropIn .25s ease both}.modal{animation:modalRise .4s var(--motion-ease) both}@keyframes backdropIn{from{opacity:0}to{opacity:1}}@keyframes modalRise{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}.modal-close{transition:transform .25s ease,background .2s ease}.modal-close:hover{transform:rotate(90deg)}
.field{animation:fieldIn .45s var(--motion-ease) both}.field:nth-child(2){animation-delay:.03s}.field:nth-child(3){animation-delay:.06s}.field:nth-child(4){animation-delay:.09s}.field:nth-child(5){animation-delay:.12s}.field:nth-child(6){animation-delay:.15s}@keyframes fieldIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.billing-machine{position:relative;overflow:hidden}.billing-machine::before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(110deg,transparent 0%,rgba(255,255,255,.035) 42%,transparent 58%);transform:translateX(-120%);animation:machineSweep 6s ease-in-out infinite}@keyframes machineSweep{0%,72%{transform:translateX(-120%)}88%,100%{transform:translateX(120%)}}.billing-machine-screen{transition:transform .4s var(--motion-ease),box-shadow .4s ease}.billing-machine:hover .billing-machine-screen{transform:translateY(-2px);box-shadow:0 14px 32px rgba(0,0,0,.12)}
.billing-transfer-animation-v2,.billing-flow{position:relative}.billing-transfer-animation-v2::before,.billing-flow::before{content:"";position:absolute;left:8%;right:8%;top:50%;height:1px;background:linear-gradient(90deg,transparent,rgba(185,223,121,.30),transparent);pointer-events:none}.billing-transfer-animation-v2 .wave-track span{animation:signalWave 1.8s ease-in-out infinite}.billing-transfer-animation-v2 .wave-track span:nth-child(2){animation-delay:.12s}.billing-transfer-animation-v2 .wave-track span:nth-child(3){animation-delay:.24s}.billing-transfer-animation-v2 .wave-track span:nth-child(4){animation-delay:.36s}.billing-transfer-animation-v2 .wave-track span:nth-child(5){animation-delay:.48s}@keyframes signalWave{0%,100%{transform:translateY(5px) scale(.82);opacity:.28}50%{transform:translateY(-5px) scale(1.15);opacity:1}}
.quotation-form-card .quotation-preview,.quotation-form-card .invoice-preview,.invoice-paper,.quotation-paper{transition:transform .4s var(--motion-ease),box-shadow .4s ease}.quotation-form-card:hover .quotation-preview,.quotation-form-card:hover .invoice-preview{transform:translateY(-3px);box-shadow:0 18px 38px rgba(20,65,55,.12)}
.report-chart path,.chart-card path{animation:chartDraw 1.3s var(--motion-ease) both}@keyframes chartDraw{from{stroke-dasharray:900;stroke-dashoffset:900;opacity:.2}to{stroke-dashoffset:0;opacity:1}}
.loading,.skeleton{animation:skeletonPulse 1.4s ease-in-out infinite}@keyframes skeletonPulse{0%,100%{opacity:.55}50%{opacity:1}}
.sidebar-overlay{animation:overlayIn .25s ease both}@keyframes overlayIn{from{opacity:0}to{opacity:1}}
@media(max-width:850px){.sidebar.sidebar-open{animation:mobileSidebarIn .42s var(--motion-ease) both}@keyframes mobileSidebarIn{from{transform:translateX(-102%)}to{transform:translateX(0)}}.page-motion{animation-duration:.42s}.card:hover,.stat-card:hover,.chart-card:hover,.report-card:hover,.reports-chart-card:hover,.customer-card:hover,.material-card:hover,.staff-card:hover,.jobs-modern-card:hover,.table-card:hover,.settings-card:hover,.appearance-card:hover,.account-big-card:hover,.daily-expense-card:hover,.quotation-form-card:hover,.billing-transactions-card:hover{transform:translateY(-2px)}}
.app.theme-dark::before{background:radial-gradient(circle at 18% 18%,rgba(89,196,161,.08),transparent 24%),radial-gradient(circle at 82% 30%,rgba(183,222,116,.055),transparent 22%),radial-gradient(circle at 55% 88%,rgba(69,157,132,.055),transparent 25%)}.app.theme-dark .topbar::after{background:linear-gradient(90deg,transparent,#73d4b2,transparent)}
@media(prefers-reduced-motion:reduce){.app::before,.topbar::after,.page-motion,.page-motion>*,.nav-group,.sub-menu,.hero::after,.hero-ring,.hero-sofa,.stat-card strong,.billing-machine::before,.billing-transfer-animation-v2 .wave-track span,.admin-dropdown,.notification-popover,.modal-backdrop,.modal-overlay,.modal,.field,.notification i,.notification.active svg,.report-chart path,.chart-card path,.loading,.skeleton,.sidebar-overlay,.sidebar.sidebar-open{animation:none!important}.card,.stat-card,.chart-card,.report-card,.reports-chart-card,.customer-card,.material-card,.staff-card,.jobs-modern-card,.table-card,.settings-card,.appearance-card,.account-big-card,.daily-expense-card,.quotation-form-card,.billing-transactions-card,.nav-item,.primary-button,.secondary-button,.hero-actions button,.create-bill-button,.job-payment-button,.jobs-new-button,.filter-button,.text-button{transition:none!important}}


/* ============================================================
   AL KANZ FINAL UX PASS — DAY/NIGHT + REAL CONTROLS + MOBILE
============================================================ */
.app.theme-day {
  --bg:#f3f8f7; --white:#ffffff; --soft:#f8fbfa; --green:#146b5e; --green-dark:#0b4d43;
  --green-light:#e4f4ef; --sidebar:#0a3f38; --sidebar-2:#115348; --sidebar-text:#bcd6d0;
  --text:#14282a; --text-2:#53686b; --muted:#87999b; --border:#dce8e6;
  --shadow:0 18px 45px rgba(14,67,58,.08);
}
.app.theme-night { color-scheme:dark; }
.app.theme-night .global-search-results,.app.theme-night .ai-panel,.app.theme-night .entity-preview-modal,.app.theme-night .print-options-modal { background:#101b18; border-color:#2b403a; color:#eef7f3; }
.app.theme-night .search-result,.app.theme-night .ai-suggestions button,.app.theme-night .print-option-list button { color:#e5f0ed; border-color:#263a35; }
.app.theme-night .search-result:hover,.app.theme-night .ai-suggestions button:hover,.app.theme-night .print-option-list button:hover { background:#173028; }
.app.theme-night .report-toolbar { background:linear-gradient(135deg,#10251f,#0c1a17); border-color:#2b403a; }
.app.theme-night .report-toolbar strong,.app.theme-night .report-toolbar small { color:#edf6f2; }
.app.theme-night .quotation-ai-box { background:#12261f; border-color:#2c4a40; }
.app.theme-night .quotation-ai-box p { color:#b8ccc6; }
.app.theme-night .theme-option { background:#101b18 !important; }
.app.theme-night .theme-preview-day { background:linear-gradient(135deg,#fff 0 50%,#dff2ec 50%); }

/* Day/Night previews */
.theme-preview-day { background:linear-gradient(135deg,#ffffff 0 50%,#cfece4 50%); }
.theme-preview-night { background:linear-gradient(135deg,#091714 0 50%,#62c7a7 50%); }
.theme-options-two { grid-template-columns:repeat(2,minmax(0,1fr)); }

/* Smart search */
.global-search-wrap { position:relative; min-width:0; }
.global-search { min-width:260px; }
.search-clear { margin-left:auto; width:24px; height:24px; border-radius:7px; display:grid; place-items:center; background:transparent; color:var(--muted); }
.search-clear:hover { background:var(--green-light); color:var(--green); }
.global-search-results { position:absolute; top:calc(100% + 9px); right:0; width:min(430px,calc(100vw - 28px)); background:var(--white); border:1px solid var(--border); border-radius:16px; box-shadow:0 22px 60px rgba(15,48,43,.18); padding:8px; z-index:120; animation:searchDrop .22s ease both; }
.search-results-head { display:flex; justify-content:space-between; padding:8px 10px; color:var(--muted); font-size:8px; font-weight:900; letter-spacing:1.3px; }
.search-result { width:100%; display:grid; grid-template-columns:32px 1fr 18px; align-items:center; gap:9px; text-align:left; padding:10px; border-radius:11px; background:transparent; color:var(--text); }
.search-result:hover { background:var(--soft); }
.search-result-icon { width:30px; height:30px; display:grid; place-items:center; border-radius:9px; background:var(--green-light); color:var(--green); }
.search-result strong,.search-result small { display:block; }
.search-result strong { font-size:10px; }
.search-result small { margin-top:3px; color:var(--muted); font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.search-empty { display:grid; justify-items:center; gap:5px; padding:24px 12px; color:var(--muted); }
.search-empty strong { color:var(--text); font-size:11px; }
.search-empty span { font-size:9px; }
@keyframes searchDrop { from { opacity:0; transform:translateY(-6px) scale(.98); } to { opacity:1; transform:none; } }

/* AI */
.ai-help-button { height:36px; display:flex; align-items:center; gap:7px; padding:0 11px; border-radius:10px; background:var(--green-light); color:var(--green); font-size:10px; font-weight:800; transition:.25s ease; }
.ai-help-button:hover,.ai-help-button.active { transform:translateY(-1px); box-shadow:0 9px 20px rgba(20,107,94,.13); }
.ai-panel { position:fixed; top:74px; right:22px; width:min(410px,calc(100vw - 30px)); background:var(--white); color:var(--text); border:1px solid var(--border); border-radius:18px; box-shadow:0 25px 70px rgba(12,50,44,.22); z-index:110; padding:15px; animation:aiPanelIn .3s cubic-bezier(.2,.8,.2,1) both; }
.ai-panel-head { display:flex; justify-content:space-between; gap:14px; padding:3px 3px 13px; }
.ai-panel-head > div > span { display:flex; align-items:center; gap:5px; color:var(--green); font-size:8px; font-weight:900; letter-spacing:1.2px; }
.ai-panel-head h3 { margin-top:6px; font-size:16px; }
.ai-panel-head p { margin-top:4px; color:var(--muted); font-size:9px; line-height:1.5; }
.ai-panel-head > button { width:28px; height:28px; border-radius:8px; background:var(--soft); color:var(--muted); }
.ai-suggestions { display:grid; gap:7px; }
.ai-suggestions button { width:100%; display:grid; grid-template-columns:31px 1fr 16px; align-items:center; gap:9px; text-align:left; padding:10px; border:1px solid var(--border); border-radius:11px; background:var(--soft); color:var(--text); }
.ai-suggestions button:hover { border-color:var(--green); transform:translateX(2px); }
.ai-suggestions strong,.ai-suggestions small { display:block; }
.ai-suggestions strong { font-size:10px; }
.ai-suggestions small { margin-top:3px; color:var(--muted); font-size:8px; line-height:1.45; }
.ai-suggestion-number { width:28px; height:28px; display:grid; place-items:center; border-radius:8px; background:var(--green-light); color:var(--green); font-size:8px; font-weight:900; }
@keyframes aiPanelIn { from{opacity:0;transform:translateY(-9px) scale(.98)} to{opacity:1;transform:none} }

/* Dashboard redesign */
.page-heading { position:relative; padding:7px 0 18px; }
.page-heading::after { content:""; position:absolute; right:0; top:0; width:180px; height:100px; border-radius:50%; background:radial-gradient(circle,rgba(113,211,178,.16),transparent 68%); pointer-events:none; }
.page-heading h1 { font-size:32px; letter-spacing:-1.3px; }
.hero { min-height:275px; border-radius:24px; box-shadow:0 22px 55px rgba(11,75,65,.18); }
.hero-text h2 { font-size:36px; line-height:1.05; letter-spacing:-1.4px; }
.hero-visual { transform:scale(1.08); }
.stats { gap:14px; }
.stat-card { border-radius:17px; min-height:112px; }
.two-column > .card { border-radius:20px; }
.card-header h2 { letter-spacing:-.45px; }

/* Eye/view controls always visibly clickable */
.row-action,.dots { cursor:pointer !important; }
.row-action { transition:transform .2s ease,background .2s ease,box-shadow .2s ease; }
.row-action:hover { transform:translateY(-2px) scale(1.04); box-shadow:0 8px 18px rgba(20,107,94,.12); }
.card-actions { display:flex; gap:5px; align-items:center; }
.staff-card-footer { display:flex; align-items:center; justify-content:space-between; margin-top:10px; }

/* Quotation */
.quotation-action-bar { flex-wrap:wrap; }
.quotation-ai-box { grid-column:1/-1; padding:12px; border:1px solid #d7e9e4; background:#f1f8f6; border-radius:13px; }
.quotation-ai-box > div { display:flex; align-items:center; gap:9px; color:var(--green); }
.quotation-ai-box strong,.quotation-ai-box small { display:block; }
.quotation-ai-box strong { color:var(--text); font-size:10px; }
.quotation-ai-box small { margin-top:2px; color:var(--muted); font-size:8px; }
.quotation-ai-box > button { margin-top:9px; }
.quotation-ai-box p { margin-top:9px; padding-top:9px; border-top:1px dashed var(--border); color:var(--text-2); font-size:9px; line-height:1.6; }
.print-options-modal,.entity-preview-modal { position:relative; width:min(560px,94vw); padding:25px; }
.print-options-modal > h2,.entity-preview-modal > h2 { margin:7px 0 5px; font-size:21px; }
.print-options-modal > p,.entity-preview-subtitle { color:var(--text-2); font-size:10px; line-height:1.6; }
.print-option-list { margin-top:18px; display:grid; gap:8px; }
.print-option-list button { display:grid; grid-template-columns:38px 1fr 16px; gap:10px; align-items:center; padding:12px; border:1px solid var(--border); border-radius:12px; background:var(--soft); color:var(--text); text-align:left; transition:.2s ease; }
.print-option-list button:hover { transform:translateX(3px); border-color:var(--green); }
.print-option-icon { width:36px; height:36px; display:grid; place-items:center; border-radius:10px; background:var(--green-light); color:var(--green); }
.print-option-list strong,.print-option-list small { display:block; }
.print-option-list strong { font-size:10px; }
.print-option-list small { margin-top:3px; color:var(--muted); font-size:8px; }
.entity-preview-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-top:18px; }
.entity-preview-grid > div { padding:11px; border:1px solid var(--border); border-radius:10px; background:var(--soft); }
.entity-preview-grid small,.entity-preview-grid strong { display:block; }
.entity-preview-grid small { color:var(--muted); font-size:7px; letter-spacing:.8px; }
.entity-preview-grid strong { margin-top:5px; font-size:10px; overflow-wrap:anywhere; }

/* Reports */
.report-toolbar { margin:0 0 16px; padding:15px 17px; border:1px solid var(--border); border-radius:16px; background:linear-gradient(135deg,#fafffd,#eef8f5); display:flex; align-items:center; justify-content:space-between; gap:15px; }
.report-toolbar span,.report-toolbar strong,.report-toolbar small { display:block; }
.report-toolbar span { font-size:7px; letter-spacing:1.4px; color:var(--green); font-weight:900; }
.report-toolbar strong { margin-top:4px; font-size:12px; }
.report-toolbar small { margin-top:3px; color:var(--muted); font-size:8px; }
.report-toolbar-actions { display:flex; gap:8px; flex-wrap:wrap; }

/* Buttons: every interactive control gives feedback */
button { -webkit-tap-highlight-color:transparent; }
button:focus-visible { outline:2px solid var(--green); outline-offset:2px; }

/* Compact mobile sidebar with icon + small label */
@media(max-width:850px){
  .ai-help-button span { display:none; }
  .ai-help-button { width:36px; padding:0; justify-content:center; }
  .topbar-right { gap:6px; }
}
@media(max-width:600px){
  .sidebar { width:218px !important; }
  .brand-area { padding:15px 12px 12px !important; }
  .brand-logo { width:34px !important; height:34px !important; }
  .brand { gap:8px !important; }
  .brand strong { font-size:10px !important; }
  .brand span { font-size:6px !important; letter-spacing:1px !important; }
  .workshop-status { margin:7px 9px !important; height:31px !important; font-size:8px !important; }
  .nav-scroll { padding:8px 8px 14px !important; }
  .nav-section-title { font-size:6px !important; letter-spacing:1.2px !important; padding:8px 8px 5px !important; }
  .nav-item { min-height:32px !important; padding:0 8px !important; border-radius:8px !important; font-size:9px !important; gap:8px !important; }
  .nav-item svg { width:15px !important; height:15px !important; flex:0 0 15px !important; }
  .nav-item > svg:last-child { width:12px !important; }
  .sub-menu { padding:2px 0 5px 29px !important; }
  .sub-menu button { min-height:25px !important; font-size:8px !important; padding:0 7px !important; }
  .account-card { padding:8px !important; gap:7px !important; }
  .account-avatar { width:27px !important; height:27px !important; font-size:8px !important; }
  .account-card strong { font-size:8px !important; }
  .account-card span { font-size:7px !important; }
  .logout { font-size:8px !important; }
  .page-heading h1 { font-size:24px !important; }
  .hero-text h2 { font-size:27px !important; }
  .hero { min-height:250px !important; border-radius:18px !important; }
  .report-toolbar { align-items:flex-start; flex-direction:column; }
  .report-toolbar-actions { width:100%; }
  .report-toolbar-actions button { flex:1; }
  .theme-options-two { grid-template-columns:1fr; }
  .entity-preview-grid { grid-template-columns:1fr; }
  .global-search { min-width:0 !important; width:100%; }
  .global-search-wrap { flex:1; }
  .global-search-results { right:auto; left:0; }
}
@media(max-width:480px){
  .topbar { gap:6px !important; }
  .breadcrumb { display:none !important; }
  .topbar-right { flex:1; }
  .global-search input { font-size:9px !important; }
  .global-search { height:34px !important; }
  .notification,.admin-profile,.ai-help-button { height:34px !important; }
  .admin-profile section { display:none !important; }
  .admin-profile { width:34px !important; padding:0 !important; justify-content:center !important; }
}

.billing-action-strip{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 0 16px;padding:12px 15px;border:1px solid var(--border);border-radius:14px;background:var(--soft);}
.billing-action-strip span,.billing-action-strip strong,.billing-action-strip small{display:block}.billing-action-strip span{font-size:7px;letter-spacing:1.3px;color:var(--green);font-weight:900}.billing-action-strip strong{font-size:10px;margin-top:3px}.billing-action-strip small{font-size:8px;color:var(--muted);margin-top:2px}.billing-action-strip>div:last-child{display:flex;gap:7px;flex-wrap:wrap}
.app.theme-night .billing-action-strip{background:#101b18;border-color:#2b403a}.app.theme-night .billing-action-strip strong{color:#edf7f3}
@media(max-width:600px){.billing-action-strip{align-items:flex-start;flex-direction:column}.billing-action-strip>div:last-child{width:100%}.billing-action-strip .secondary-button{flex:1}}

@media(prefers-reduced-motion:reduce){
  .ai-panel,.global-search-results { animation:none !important; }
}
`;

const FINAL_CSS = CSS + AL_KANZ_FINAL_RESPONSIVE + AL_KANZ_FINAL_FIX + AL_KANZ_LAST_FIX + AL_KANZ_TRUE_FINAL_FIX + AL_KANZ_FULL_MOTION_CSS;

export default App;
