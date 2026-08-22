import React, { useMemo, useState } from "react";
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
  IndianRupee,
} from "lucide-react";

/* ============================================================
   AL KANZ UPHOLSTERY
   COMPLETE SINGLE-FILE APPLICATION
============================================================ */

const INITIAL_JOBS = [
  {
    id: "AK-1048",
    customer: "Ahmed Rahman",
    phone: "+91 98765 43210",
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
    phone: "+91 98470 12345",
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
    phone: "+91 99887 66554",
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
    phone: "+91 98989 11223",
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
    phone: "+91 98765 43210",
    location: "Mangalore",
    jobs: 3,
    outstanding: 16000,
  },
  {
    id: 2,
    name: "Nabeel Ahmed",
    phone: "+91 98470 12345",
    location: "Mangalore",
    jobs: 2,
    outstanding: 7000,
  },
  {
    id: 3,
    name: "Sameer Khan",
    phone: "+91 99887 66554",
    location: "Bangalore",
    jobs: 4,
    outstanding: 8500,
  },
  {
    id: 4,
    name: "Faris Traders",
    phone: "+91 98989 11223",
    location: "Mangalore",
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
    phone: "+91 98111 22233",
    material: "Leather",
    balance: 18500,
  },
  {
    id: 2,
    name: "Modern Fabrics",
    phone: "+91 98222 33344",
    material: "Fabric",
    balance: 7200,
  },
  {
    id: 3,
    name: "Foam House",
    phone: "+91 98333 44455",
    material: "Foam",
    balance: 4500,
  },
];

const INITIAL_STAFF = [
  {
    id: 1,
    name: "Mohammed Afsal",
    role: "Master Upholsterer",
    phone: "+91 98700 11122",
    status: "Active",
  },
  {
    id: 2,
    name: "Shameer",
    role: "Leather Technician",
    phone: "+91 98700 22233",
    status: "Active",
  },
  {
    id: 3,
    name: "Riyas",
    role: "Stitching Specialist",
    phone: "+91 98700 33344",
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
        children: ["Main", "Invoices", "Payments"],
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
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function App() {
  const [page, setPage] = useState("Dashboard");
  const [jobs, setJobs] = useState(INITIAL_JOBS);
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [materials, setMaterials] = useState(INITIAL_MATERIALS);
  const [suppliers] = useState(INITIAL_SUPPLIERS);
  const [staff] = useState(INITIAL_STAFF);

  const [open, setOpen] = useState({
    "Jobs & Repairs": true,
    Billing: true,
    Accounts: true,
    Settings: true,
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState("");

  const totalSales = jobs.reduce((a, b) => a + b.amount, 0);
  const totalPaid = jobs.reduce((a, b) => a + b.paid, 0);
  const outstanding = totalSales - totalPaid;

  const activeJobs = jobs.filter(
    (j) => j.status === "In Progress"
  ).length;

  const readyJobs = jobs.filter(
    (j) => j.status === "Ready"
  ).length;

  const navigate = (name) => {
    setPage(name);
    setSidebarOpen(false);

    if (name === "New Repair Job") {
      setModal("job");
    }
  };

  const addJob = (job) => {
    setJobs((prev) => [
      {
        ...job,
        id: `AK-${1050 + prev.length}`,
        date: new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        progress: 0,
        status: "In Progress",
      },
      ...prev,
    ]);

    setModal(null);
    setPage("Active Jobs");
  };

  const addCustomer = (customer) => {
    setCustomers((prev) => [
      ...prev,
      {
        ...customer,
        id: Date.now(),
        jobs: 0,
        outstanding: 0,
      },
    ]);

    setModal(null);
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
      <style>{CSS}</style>

      <div className="app">
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
                            setOpen((prev) => ({
                              ...prev,
                              [item.name]:
                                !prev[item.name],
                            }));
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
                              open[item.name]
                                ? "chevron-open"
                                : ""
                            }
                          />
                        )}
                      </button>

                      {hasChildren &&
                        open[item.name] && (
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

        {/* =====================================================
            MAIN
        ===================================================== */}

        <main className="main">
          <header className="topbar">
            <div className="topbar-left">
              <button
                className="mobile-menu"
                onClick={() =>
                  setSidebarOpen(true)
                }
              >
                <Menu size={21} />
              </button>

              <div className="breadcrumb">
                <span>Al Kanz</span>
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

              <button className="notification">
                <Bell size={18} />
                <i />
              </button>

              <div className="admin-profile">
                <div>AK</div>
                <section>
                  <strong>Admin</strong>
                  <span>Owner</span>
                </section>
                <ChevronDown size={14} />
              </div>
            </div>
          </header>

          <div className="content">
            {page === "Dashboard" && (
              <Dashboard
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
              <SuppliersPage suppliers={suppliers} />
            )}

            {page === "Staff" && (
              <StaffPage staff={staff} />
            )}

            {(page === "Billing" ||
              page === "Main" ||
              page === "Invoices" ||
              page === "Payments") && (
              <BillingPage
                page={page}
                jobs={jobs}
                outstanding={outstanding}
                totalPaid={totalPaid}
              />
            )}

            {page === "Reports" && (
              <ReportsPage
                jobs={jobs}
                totalPaid={totalPaid}
                outstanding={outstanding}
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
              />
            )}

            {(page === "Settings" ||
              page === "User" ||
              page === "Audit & Security") && (
              <SettingsPage page={page} />
            )}
          </div>
        </main>

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
              setMaterials((prev) => [
                ...prev,
                {
                  ...material,
                  id: Date.now(),
                },
              ]);
              setModal(null);
            }}
          />
        )}
      </div>
    </>
  );
}

/* ============================================================
   DASHBOARD
============================================================ */

function Dashboard({
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
            FRIDAY · 21 AUGUST 2026
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
            Repair. Restore.
            <br />
            Make it new again.
          </h2>

          <p>
            Manage upholstery jobs, leather replacement,
            materials, payments and customer billing from
            one place.
          </p>

          <div className="hero-actions">
            <button
              onClick={() => setModal("job")}
            >
              <Plus size={15} />
              New repair job
            </button>

            <button
              onClick={() => navigate("Active Jobs")}
            >
              View active jobs
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
            <IndianRupee size={19} />
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
            <strong>₹38,000</strong>
          </div>

          <div className="large-progress">
            <span style={{ width: "68%" }} />
          </div>

          <div className="finance-meta">
            <span>68% collected</span>
            <strong>₹18,000 pending</strong>
          </div>

          <div className="recent-payments">
            <Payment
              name="Ahmed Rahman"
              amount="₹10,000"
              time="10 min ago"
            />

            <Payment
              name="Faris Traders"
              amount="₹5,000"
              time="1 hour ago"
            />

            <Payment
              name="Sameer Khan"
              amount="₹8,000"
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
}) {
  const filtered =
    title === "Active Jobs"
      ? jobs.filter(
          (j) => j.status === "In Progress"
        )
      : title === "Completed Jobs"
      ? jobs.filter(
          (j) => j.status === "Ready"
        )
      : title === "Delivered"
      ? jobs.filter(
          (j) => j.status === "Delivered"
        )
      : jobs;

  return (
    <>
      <PageTitle
        eyebrow="WORKSHOP"
        title={title}
        subtitle="Manage upholstery and repair work."
        button="New Repair Job"
        onClick={() => setModal("job")}
      />

      <div className="toolbar">
        <div className="filter-search">
          <Search size={16} />
          <input placeholder="Search repair jobs..." />
        </div>

        <button className="filter-button">
          All status <ChevronDown size={14} />
        </button>
      </div>

      <div className="table-card">
        <div className="table-head">
          <span>JOB</span>
          <span>CUSTOMER</span>
          <span>WORK</span>
          <span>STATUS</span>
          <span>AMOUNT</span>
          <span>BALANCE</span>
          <span />
        </div>

        {filtered.map((job) => (
          <div className="table-row" key={job.id}>
            <strong>{job.id}</strong>

            <div>
              <strong>{job.customer}</strong>
              <small>{job.phone}</small>
            </div>

            <div>
              <strong>{job.item}</strong>
              <small>{job.work}</small>
            </div>

            <Status status={job.status} />

            <strong>{money(job.amount)}</strong>

            <strong>
              {money(job.amount - job.paid)}
            </strong>

            <button className="row-action">
              <Eye size={16} />
            </button>
          </div>
        ))}

        {filtered.length === 0 && (
          <EmptyState
            icon={ClipboardList}
            title="No jobs found"
            text="There are no jobs in this section yet."
          />
        )}
      </div>
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
                ₹{material.price} / {material.unit}
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

function SuppliersPage({ suppliers }) {
  return (
    <>
      <PageTitle
        eyebrow="WORKSHOP"
        title="Suppliers"
        subtitle="Manage material suppliers and balances."
        button="Add Supplier"
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
          <div
            className="table-row supplier-row"
            key={supplier.id}
          >
            <div>
              <strong>{supplier.name}</strong>
              <small>Supplier #{supplier.id}</small>
            </div>

            <span>{supplier.phone}</span>

            <span>{supplier.material}</span>

            <strong>
              {money(supplier.balance)}
            </strong>

            <button className="row-action">
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

function StaffPage({ staff }) {
  return (
    <>
      <PageTitle
        eyebrow="TEAM"
        title="Staff"
        subtitle="Manage workshop employees and responsibilities."
        button="Add Staff"
      />

      <div className="staff-grid">
        {staff.map((person) => (
          <div className="staff-card" key={person.id}>
            <div className="staff-avatar">
              {person.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </div>

            <h3>{person.name}</h3>

            <p>{person.role}</p>

            <span>{person.phone}</span>

            <label
              className={
                person.status === "Active"
                  ? "staff-active"
                  : "staff-leave"
              }
            >
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

function BillingPage({
  page,
  jobs,
  outstanding,
  totalPaid,
}) {
  const invoices = jobs.map((job) => ({
    id: `INV-${job.id.replace("AK-", "")}`,
    customer: job.customer,
    amount: job.amount,
    paid: job.paid,
    balance: job.amount - job.paid,
    status:
      job.amount === job.paid
        ? "Paid"
        : job.paid > 0
        ? "Part Paid"
        : "Unpaid",
  }));

  return (
    <>
      <PageTitle
        eyebrow="BILLING"
        title={
          page === "Billing"
            ? "Billing"
            : page
        }
        subtitle="Invoices, payments and customer billing."
        button="Create Invoice"
      />

      <div className="billing-stats">
        <Stat
          icon={FileText}
          label="Invoices"
          value={invoices.length}
          note="this month"
          color="blue"
        />

        <Stat
          icon={CircleDollarSign}
          label="Billed"
          value={money(
            invoices.reduce(
              (a, b) => a + b.amount,
              0
            )
          )}
          note="total invoices"
          color="green"
        />

        <Stat
          icon={CreditCard}
          label="Collected"
          value={money(totalPaid)}
          note="payments received"
          color="purple"
        />

        <Stat
          icon={AlertCircle}
          label="Outstanding"
          value={money(outstanding)}
          note="pending payment"
          color="orange"
        />
      </div>

      <div className="table-card">
        <div className="table-head invoice-head">
          <span>INVOICE</span>
          <span>CUSTOMER</span>
          <span>AMOUNT</span>
          <span>PAID</span>
          <span>BALANCE</span>
          <span>STATUS</span>
        </div>

        {invoices.map((invoice) => (
          <div
            className="table-row"
            key={invoice.id}
          >
            <strong>{invoice.id}</strong>

            <strong>{invoice.customer}</strong>

            <strong>
              {money(invoice.amount)}
            </strong>

            <strong>
              {money(invoice.paid)}
            </strong>

            <strong>
              {money(invoice.balance)}
            </strong>

            <Status status={invoice.status} />
          </div>
        ))}
      </div>
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
}) {
  const total = jobs.reduce(
    (a, b) => a + b.amount,
    0
  );

  return (
    <>
      <PageTitle
        eyebrow="FINANCE"
        title="Reports"
        subtitle="Understand workshop performance and finances."
      />

      <div className="report-grid">
        <ReportBox
          icon={TrendingUp}
          title="Total Revenue"
          value={money(total)}
          note="+12.4% compared to last month"
        />

        <ReportBox
          icon={CircleDollarSign}
          title="Payments Collected"
          value={money(totalPaid)}
          note="Customer payments received"
        />

        <ReportBox
          icon={AlertCircle}
          title="Outstanding"
          value={money(outstanding)}
          note="Still to be collected"
        />

        <ReportBox
          icon={Wrench}
          title="Jobs Completed"
          value={
            jobs.filter(
              (j) =>
                j.status === "Ready" ||
                j.status === "Delivered"
            ).length
          }
          note="Ready or delivered jobs"
        />
      </div>

      <div className="card report-chart">
        <CardHeader
          eyebrow="REVENUE"
          title="Monthly workshop performance"
          subtitle="Revenue overview"
        />

        <div className="bars">
          {[42, 58, 47, 72, 64, 86, 75, 94, 69, 82, 77, 91].map(
            (height, index) => (
              <div className="bar-wrap" key={index}>
                <div
                  className="bar"
                  style={{
                    height: `${height}%`,
                  }}
                />
                <span>
                  {
                    [
                      "Jan",
                      "Feb",
                      "Mar",
                      "Apr",
                      "May",
                      "Jun",
                      "Jul",
                      "Aug",
                      "Sep",
                      "Oct",
                      "Nov",
                      "Dec",
                    ][index]
                  }
                </span>
              </div>
            )
          )}
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

function AccountsPage({
  page,
  totalPaid,
  outstanding,
}) {
  return (
    <>
      <PageTitle
        eyebrow="FINANCE"
        title={page}
        subtitle="Manage workshop accounts and money movement."
      />

      <div className="account-tabs">
        <button className={page === "Accounts" ? "active" : ""}>
          Overview
        </button>
        <button className={page === "Ledger" ? "active" : ""}>
          Ledger
        </button>
        <button className={page === "Expenses" ? "active" : ""}>
          Expenses
        </button>
        <button className={page === "Move Money" ? "active" : ""}>
          Move Money
        </button>
      </div>

      <div className="account-overview">
        <div className="account-big-card">
          <span>Cash & Bank</span>
          <strong>₹1,42,500</strong>
          <small>Available balance</small>
        </div>

        <div className="account-big-card">
          <span>Customer Receivables</span>
          <strong>{money(outstanding)}</strong>
          <small>Money to collect</small>
        </div>

        <div className="account-big-card">
          <span>Payments Received</span>
          <strong>{money(totalPaid)}</strong>
          <small>This month</small>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head">
          <span>DATE</span>
          <span>DESCRIPTION</span>
          <span>TYPE</span>
          <span>ACCOUNT</span>
          <span>AMOUNT</span>
        </div>

        <div className="table-row">
          <span>21 Aug 2026</span>
          <strong>Customer Payment · Ahmed Rahman</strong>
          <Status status="Income" />
          <span>Cash</span>
          <strong className="income">+₹10,000</strong>
        </div>

        <div className="table-row">
          <span>20 Aug 2026</span>
          <strong>Leather purchase</strong>
          <Status status="Expense" />
          <span>Bank</span>
          <strong className="expense">-₹18,500</strong>
        </div>

        <div className="table-row">
          <span>19 Aug 2026</span>
          <strong>Customer Payment · Faris Traders</strong>
          <Status status="Income" />
          <span>Cash</span>
          <strong className="income">+₹5,000</strong>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   SETTINGS
============================================================ */

function SettingsPage({ page }) {
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
              <input
                value="admin@alkanzupholstery.com"
                readOnly
              />
            </label>

            <label>
              Phone
              <input
                value="+91 98765 00000"
                readOnly
              />
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
    work: "Full Leather Replacement",
    material: "Premium Leather",
    amount: "",
    paid: "",
  });

  const update = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));

  const submit = (e) => {
    e.preventDefault();

    if (!form.customer || !form.amount) {
      alert(
        "Please enter customer name and amount."
      );
      return;
    }

    save({
      ...form,
      amount: Number(form.amount),
      paid: Number(form.paid || 0),
    });
  };

  return (
    <Modal
      title="New Repair Job"
      subtitle="Create a new upholstery or repair job."
      close={close}
    >
      <form onSubmit={submit}>
        <div className="modal-grid">
          <Field
            label="Customer name"
            value={form.customer}
            onChange={(v) =>
              update("customer", v)
            }
            placeholder="Enter customer name"
          />

          <Field
            label="Phone number"
            value={form.phone}
            onChange={(v) =>
              update("phone", v)
            }
            placeholder="+91 XXXXX XXXXX"
          />

          <SelectField
            label="Item"
            value={form.item}
            onChange={(v) =>
              update("item", v)
            }
            options={[
              "3-Seater Sofa",
              "2-Seater Sofa",
              "Recliner",
              "Dining Chairs",
              "Car Seat",
              "Office Sofa",
            ]}
          />

          <SelectField
            label="Repair / Work"
            value={form.work}
            onChange={(v) =>
              update("work", v)
            }
            options={[
              "Full Leather Replacement",
              "Leather Repair",
              "Repair & Stitching",
              "Fabric Replacement",
              "Re-Upholstery",
              "Foam Replacement",
            ]}
          />

          <Field
            label="Material"
            value={form.material}
            onChange={(v) =>
              update("material", v)
            }
            placeholder="Leather / Fabric / Foam"
          />

          <Field
            label="Total amount"
            type="number"
            value={form.amount}
            onChange={(v) =>
              update("amount", v)
            }
            placeholder="₹ 0"
          />

          <Field
            label="Advance paid"
            type="number"
            value={form.paid}
            onChange={(v) =>
              update("paid", v)
            }
            placeholder="₹ 0"
          />

          <Field
            label="Expected delivery"
            type="date"
            value=""
            onChange={() => {}}
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
            <Plus size={16} />
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
            placeholder="+91 XXXXX XXXXX"
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
            placeholder="₹ 0"
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

const CSS = `
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

.admin-profile {
  gap: 8px;
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
  grid-template-columns: 230px 1fr;
  gap: 17px;
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

  .settings-form {
    grid-template-columns: 1fr;
  }

  .modal-grid {
    grid-template-columns: 1fr;
  }
}
`;

export default App;