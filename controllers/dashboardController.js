import pool from "../config/db.js";

const today = new Date().toISOString().split("T")[0];
const logQueries = process.env.LOG_QUERIES === "true";
const log = (...args) => {
  if (logQueries) console.log(...args);
};

// Helper function to get current month range
const getCurrentMonthRange = () => {
  const currentDate = new Date();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
  const currentDayStr = currentDate.toISOString().split('T')[0];
  return { firstDayStr, currentDayStr };
};

export const getDashboardData = async (req, res) => {
  try {
    const {
      dashboardType,
      staffFilter,
      page = 1,
      limit = 50,
      departmentFilter,
      role,
      username,
      taskView = "recent",
    } = req.query;

    const table = dashboardType;
    const offset = (page - 1) * limit;

    const { firstDayStr, currentDayStr } = getCurrentMonthRange();

    let query = `SELECT * FROM ${table} WHERE 1=1`;

    // ---------------------------
    // ROLE FILTER (USER) ✅ TRIM FIX
    // ---------------------------
    if (role === "user" && username) {
      query += ` AND TRIM(LOWER(name)) = TRIM(LOWER('${username}'))`;
    }

    // ---------------------------
    // ADMIN STAFF FILTER
    // ---------------------------
    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    // ---------------------------
    // DEPARTMENT FILTER
    // ---------------------------
    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER('${departmentFilter}')`;
    }

    // ---------------------------
    // TASK VIEW FILTERS
    // ---------------------------
    if (taskView === "recent") {
      query += ` AND task_start_date::date = CURRENT_DATE`;
      if (dashboardType === "checklist") {
        query += ` AND submission_date IS NULL`;
      }
    } else if (taskView === "upcoming") {
      query += ` AND task_start_date::date = (CURRENT_DATE + INTERVAL '1 day')::date`;
      if (dashboardType === "checklist") {
        query += ` AND submission_date IS NULL`;
      }
    } else if (taskView === "overdue") {
      query += ` AND task_start_date::date < CURRENT_DATE AND submission_date IS NULL`;
    } else if (taskView === "all") {
      query += `
        AND task_start_date >= '${firstDayStr} 00:00:00'
        AND task_start_date <= '${currentDayStr} 23:59:59'
      `;
    }

    query += ` ORDER BY task_start_date ASC LIMIT ${limit} OFFSET ${offset}`;

    log("FINAL QUERY =>", query);

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error("ERROR in getDashboardData:", err);
    res.status(500).send("Error fetching dashboard data");
  }
};

export const getTotalTask = async (req, res) => {
  try {
    const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;
    const { firstDayStr, currentDayStr } = getCurrentMonthRange();

    let query = `
      SELECT COUNT(*) AS count
      FROM ${dashboardType}
      WHERE task_start_date >= '${firstDayStr} 00:00:00'
      AND task_start_date <= '${currentDayStr} 23:59:59'
    `;

    if (role === "user" && username) {
      query += ` AND TRIM(LOWER(name)) = TRIM(LOWER('${username}'))`;
    }

    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER('${departmentFilter}')`;
    }

    const result = await pool.query(query);
    res.json(Number(result.rows[0].count));
  } catch (err) {
    console.error("TOTAL ERROR:", err.message);
    res.status(500).json({ error: "Error fetching total tasks" });
  }
};

export const getCompletedTask = async (req, res) => {
  try {
    const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;
    const { firstDayStr, currentDayStr } = getCurrentMonthRange();

    let query = `
      SELECT COUNT(*) AS count
      FROM ${dashboardType}
      WHERE task_start_date >= '${firstDayStr} 00:00:00'
      AND task_start_date <= '${currentDayStr} 23:59:59'
    `;

    if (dashboardType === "checklist") {
      query += ` AND status = 'yes'`;
    } else {
      query += ` AND submission_date IS NOT NULL`;
    }

    if (role === "user" && username) {
      query += ` AND TRIM(LOWER(name)) = TRIM(LOWER('${username}'))`;
    }

    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER('${departmentFilter}')`;
    }

    const result = await pool.query(query);
    res.json(Number(result.rows[0].count));
  } catch (err) {
    console.error("COMPLETED ERROR:", err.message);
    res.status(500).json({ error: "Error fetching completed tasks" });
  }
};

export const getPendingTask = async (req, res) => {
  try {
    const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;

    let query = `
      SELECT COUNT(*) AS count
      FROM ${dashboardType}
      WHERE task_start_date::date = CURRENT_DATE
      AND submission_date IS NULL
    `;

    if (role === "user" && username) {
      query += ` AND TRIM(LOWER(name)) = TRIM(LOWER('${username}'))`;
    }

    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER('${departmentFilter}')`;
    }

    const result = await pool.query(query);
    res.json(Number(result.rows[0].count));
  } catch (err) {
    console.error("PENDING ERROR:", err.message);
    res.status(500).json({ error: "Error fetching pending tasks" });
  }
};

export const getOverdueTask = async (req, res) => {
  try {
    const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;
    const params = [];
    let idx = 1;

    let query = `
      SELECT COUNT(*) AS count
      FROM ${dashboardType}
      WHERE task_start_date::date < CURRENT_DATE
      AND submission_date IS NULL
    `;

    if (role === "user" && username) {
      query += ` AND TRIM(LOWER(name)) = TRIM(LOWER($${idx++}))`;
      params.push(username);
    }

    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER($${idx++})`;
      params.push(staffFilter);
    }

    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER($${idx++})`;
      params.push(departmentFilter);
    }

    const result = await pool.query(query, params);
    res.json(Number(result.rows[0].count));
  } catch (err) {
    console.error("OVERDUE ERROR:", err.message);
    res.status(500).json({ error: "Error fetching overdue tasks" });
  }
};

export const getNotDoneTask = async (req, res) => {
  try {
    const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;
    const table = dashboardType;
    
    // Get current month range
    const { firstDayStr, currentDayStr } = getCurrentMonthRange();

    let query = `
      SELECT COUNT(*) AS count
      FROM ${table}
      WHERE task_start_date >= '${firstDayStr} 00:00:00'
      AND task_start_date <= '${currentDayStr} 23:59:59'
      AND status = 'no'
      AND submission_date IS NOT NULL
    `;

    if (role === "user" && username) {
      query += ` AND name = '${username}'`;
    }

    if (role === "admin" && staffFilter !== "all") {
      query += ` AND name = '${staffFilter}'`;
    }

    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND department = '${departmentFilter}'`;
    }

    const result = await pool.query(query);
    res.json(Number(result.rows[0].count || 0));

  } catch (err) {
    console.error("❌ NOT DONE ERROR:", err.message);
    res.status(500).json({ error: "Error fetching not done tasks" });
  }
};

// export const getOverdueTask = async (req, res) => {
//   try {
//     const { dashboardType, staffFilter, departmentFilter, role, username } = req.query;

//     const table = dashboardType;
//     const params = [];
//     let idx = 1;

//     // Align with task list overdue view: before today and not submitted
//     let query = `
//       SELECT COUNT(*) AS count
//       FROM ${table}
//       WHERE task_start_date::date < CURRENT_DATE
//       AND submission_date IS NULL
//     `;

//     // Role filter
//     if (role === "user" && username) {
//       query += ` AND LOWER(name)=LOWER($${idx++})`;
//       params.push(username);
//     }

//     if (role === "admin" && staffFilter !== "all") {
//       query += ` AND LOWER(name)=LOWER($${idx++})`;
//       params.push(staffFilter);
//     }

//     // Department filter
//     if (dashboardType === "checklist" && departmentFilter !== "all") {
//       query += ` AND LOWER(department)=LOWER($${idx++})`;
//       params.push(departmentFilter);
//     }

//     const result = await pool.query(query, params);
//     res.json(Number(result.rows[0].count));

//   } catch (err) {
//     console.error("OVERDUE ERROR:", err.message);
//     res.status(500).json({ error: "Error fetching overdue tasks" });
//   }
// };



export const getUniqueDepartments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT department FROM users 
      WHERE department IS NOT NULL AND department!=''
    `);

    res.json(result.rows.map(d => d.department));
  } catch (err) {
    console.error("DEPARTMENTS ERROR:", err.message);
    res.status(500).json({ error: "Error fetching departments" });
  }
};

export const getStaffByDepartment = async (req, res) => {
  try {
    const { department } = req.query;

    let query = `SELECT user_name, user_access FROM users`;

    const result = await pool.query(query);

    let staff = result.rows;

    if (department && department !== "all") {
      staff = staff.filter(u =>
        u.user_access &&
        u.user_access.toLowerCase().includes(department.toLowerCase())
      );
    }

    res.json(staff.map(s => s.user_name));
  } catch (err) {
    console.error("STAFF BY DEPARTMENT ERROR:", err.message);
    res.status(500).json({ error: "Error fetching staff by department" });
  }
};

export const getChecklistByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, staffFilter = "all", departmentFilter = "all" } = req.query;

    // If no specific date range is provided, default to current month
    let start = startDate;
    let end = endDate;
    
    if (!startDate || !endDate) {
      const { firstDayStr, currentDayStr } = getCurrentMonthRange();
      start = firstDayStr;
      end = currentDayStr;
    }

    // Build parameterized query to avoid string-based date comparisons
    // Compare on date-only to avoid timezone boundary misses
    const params = [start, end];
    let idx = 3;

    let query = `
      SELECT * FROM checklist
      WHERE task_start_date::date >= $1::date
      AND task_start_date::date <= $2::date
    `;

    if (staffFilter && staffFilter !== "all") {
      query += ` AND LOWER(name)=LOWER($${idx++})`;
      params.push(staffFilter);
    }

    if (departmentFilter && departmentFilter !== "all") {
      query += ` AND LOWER(department)=LOWER($${idx++})`;
      params.push(departmentFilter);
    }

    // Keep the payload bounded to avoid overwhelming the client
    query += " ORDER BY task_start_date ASC LIMIT 5000";

    const result = await pool.query(query, params);
    log("DATE RANGE QUERY =>", query, "PARAMS =>", params, "ROWS =>", result.rowCount);
    res.json(result.rows);
  } catch (err) {
    console.error("CHECKLIST DATE RANGE ERROR:", err.message);
    res.status(500).json({ error: "Error fetching checklist by date range" });
  }
};

export const getChecklistStatsByDate = async (req, res) => {
  try {
    const { startDate, endDate, staffFilter = "all", departmentFilter = "all" } = req.query;

    // If no date range provided, default to current month
    let start = startDate;
    let end = endDate;
    
    if (!startDate || !endDate) {
      const { firstDayStr, currentDayStr } = getCurrentMonthRange();
      start = firstDayStr;
      end = currentDayStr;
    }

    // Compare on date-only to avoid timezone boundary misses
    const params = [start, end];
    let idx = 3;

    let query = `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN LOWER(status::text) = 'yes' THEN 1 ELSE 0 END) AS completed_tasks,
        SUM(CASE WHEN LOWER(status::text) = 'no' THEN 1 ELSE 0 END) AS not_done_tasks,
        SUM(
          CASE 
            WHEN (status IS NULL OR LOWER(status::text) <> 'yes')
              AND task_start_date::date < CURRENT_DATE
            THEN 1 ELSE 0 END
        ) AS overdue_tasks
      FROM checklist
      WHERE task_start_date::date >= $1::date
      AND task_start_date::date <= $2::date
    `;

    if (staffFilter && staffFilter !== "all") {
      query += ` AND LOWER(name)=LOWER($${idx++})`;
      params.push(staffFilter);
    }
    if (departmentFilter && departmentFilter !== "all") {
      query += ` AND LOWER(department)=LOWER($${idx++})`;
      params.push(departmentFilter);
    }

    const result = await pool.query(query, params);
    log("DATE RANGE STATS QUERY =>", query, "PARAMS =>", params, "ROWS =>", result.rowCount);

    const row = result.rows[0] || {};
    const totalTasks = Number(row.total_tasks || 0);
    const completedTasks = Number(row.completed_tasks || 0);
    const overdueTasks = Number(row.overdue_tasks || 0);
    const notDoneTasks = Number(row.not_done_tasks || 0);
    const pendingTasks = Math.max(totalTasks - completedTasks, 0);

    res.json({
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      notDone: notDoneTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
    });
  } catch (err) {
    console.error("CHECKLIST STATS ERROR:", err.message);
    res.status(500).json({ error: "Error fetching checklist stats" });
  }
};

export const getStaffTaskSummary = async (req, res) => {
  try {
    const { dashboardType } = req.query;
    const table = dashboardType;
    
    // Get current month range
    const { firstDayStr, currentDayStr } = getCurrentMonthRange();

    const query = `
      SELECT name,
        COUNT(*) AS total,
        SUM(
          CASE 
            WHEN submission_date IS NOT NULL THEN 1
            WHEN status = 'Yes' THEN 1
            ELSE 0 
          END
        ) AS completed
      FROM ${table}
      WHERE task_start_date >= '${firstDayStr} 00:00:00'
      AND task_start_date <= '${currentDayStr} 23:59:59'
      GROUP BY name
      ORDER BY name ASC
    `;

    const result = await pool.query(query);

    const formatted = result.rows.map(r => ({
      id: r.name?.toLowerCase().replace(/\s+/g, "-"),
      name: r.name,
      email: `${r.name?.toLowerCase().replace(/\s+/g, ".")}@example.com`,
      totalTasks: Number(r.total),
      completedTasks: Number(r.completed),
      pendingTasks: Number(r.total) - Number(r.completed),
      progress: Math.round((Number(r.completed) / Number(r.total)) * 100)
    }));

    res.json(formatted);
    
  } catch (err) {
    console.error("STAFF SUMMARY ERROR:", err.message);
    res.status(500).json({ error: "Error fetching staff task summary" });
  }
};

export const getDashboardDataCount = async (req, res) => {
  try {
    const { 
      dashboardType, 
      staffFilter = "all", 
      taskView = "recent", 
      departmentFilter = "all" 
    } = req.query;

    const role = req.query.role;
    const username = req.query.username;

    // Base query (no month cap) so it matches list view filters exactly
    let query = `
      SELECT COUNT(*) AS count
      FROM ${dashboardType}
      WHERE 1=1
    `;

    // ROLE FILTER (USER)
    if (role === "user" && username) {
      query += ` AND LOWER(name) = LOWER('${username}')`;
    }

    // ADMIN STAFF FILTER
    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER('${staffFilter}')`;
    }

    // DEPARTMENT FILTER (checklist only)
    if (dashboardType === "checklist" && departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER('${departmentFilter}')`;
    }

    // TASK VIEW LOGIC
    if (taskView === "recent") {
      query += `
        AND DATE(task_start_date) = CURRENT_DATE
      `;

      if (dashboardType === "checklist") {
        // query += ` AND (status IS NULL OR status <> 'yes')`;
        query += ` AND submission_date IS NULL`;
      }
    } 
    else if (taskView === "upcoming") {
      query += `
        AND DATE(task_start_date) = CURRENT_DATE + INTERVAL '1 day'
      `;

      if (dashboardType === "checklist") {
        query += ` AND submission_date IS NULL`;
      }
    }
    else if (taskView === "overdue") {
      query += `
        AND DATE(task_start_date) < CURRENT_DATE
        AND submission_date IS NULL
      `;

      if (dashboardType === "checklist") {
        // query += ` AND (status IS NULL OR status <> 'yes')`;
        query += ` AND submission_date IS NULL`;
      }
    }

    const result = await pool.query(query);
    const count = Number(result.rows[0].count || 0);
    
    log("COUNT QUERY for", taskView, "=>", query);
    log("COUNT RESULT:", count);
    
    res.json(count);

  } catch (err) {
    console.error("DASHBOARD COUNT ERROR:", err.message);
    res.status(500).json({ error: "Error fetching dashboard count" });
  }
};

export const getChecklistDateRangeCount = async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      staffFilter = "all", 
      departmentFilter = "all", 
      statusFilter = "all" 
    } = req.query;

    const role = req.query.role;
    const username = req.query.username;

    // If no date range provided, default to current month
    let start = startDate;
    let end = endDate;
    
    if (!startDate || !endDate) {
      const { firstDayStr, currentDayStr } = getCurrentMonthRange();
      start = firstDayStr;
      end = currentDayStr;
    }

    // Compare on date-only to avoid timezone boundary misses
    const params = [start, end];
    let idx = 3;

    let query = `
      SELECT COUNT(*) AS count
      FROM checklist
      WHERE task_start_date::date >= $1::date
      AND task_start_date::date <= $2::date
    `;

    // ROLE FILTER (USER)
    if (role === "user" && username) {
      query += ` AND LOWER(name) = LOWER($${idx++})`;
      params.push(username);
    }

    // ADMIN STAFF FILTER
    if (role === "admin" && staffFilter !== "all") {
      query += ` AND LOWER(name) = LOWER($${idx++})`;
      params.push(staffFilter);
    }

    // DEPARTMENT FILTER
    if (departmentFilter !== "all") {
      query += ` AND LOWER(department) = LOWER($${idx++})`;
      params.push(departmentFilter);
    }

    // STATUS FILTER
    switch (statusFilter) {
      case "completed":
        query += ` AND LOWER(status::text) = 'yes'`;
        break;
      case "pending":
        query += ` AND (status IS NULL OR LOWER(status::text) <> 'yes')`;
        break;
      case "overdue":
        query += ` 
          AND (status IS NULL OR LOWER(status::text) <> 'yes')
          AND submission_date IS NULL
          AND task_start_date < CURRENT_DATE
        `;
        break;
    }

    const result = await pool.query(query, params);
    const count = Number(result.rows[0].count || 0);
    
    res.json(count);

  } catch (err) {
    console.error("DATE RANGE COUNT ERROR:", err.message);
    res.status(500).json({ error: "Error fetching date range count" });
  }
};

