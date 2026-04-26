use crate::db::Database;
use crate::models::*;
use rusqlite::params;

impl Database {
    pub fn save_run(&self, r: &RunHistory) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "INSERT INTO run_history VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            params![
                r.id,
                r.provider_id,
                r.model_id,
                r.protocol,
                r.test_case_id,
                r.matrix_run_id,
                r.request_snapshot.to_string(),
                r.response_raw,
                r.response_parsed
                    .as_ref()
                    .map(|v| serde_json::to_string(v).unwrap_or_default()),
                r.status_code.map(|s| s as i32),
                r.error_message,
                r.duration_ms.map(|d| d as i64),
                r.stream as i32,
                r.compat_results
                    .as_ref()
                    .map(|v| serde_json::to_string(v).unwrap_or_default()),
                r.created_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_run_history(&self, f: &HistoryFilter) -> Result<Vec<RunHistorySummary>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut sql = String::from("SELECT id,provider_id,model_id,protocol,status_code,duration_ms,stream,compat_results,created_at FROM run_history WHERE 1=1");
        let mut vals: Vec<String> = Vec::new();
        macro_rules! flt {
            ($o:expr,$col:literal) => {
                if let Some(ref v) = $o {
                    vals.push(v.clone());
                    sql.push_str(&format!(concat!(" AND ", $col, "=?{}"), vals.len()));
                }
            };
        }
        flt!(f.provider_id, "provider_id");
        flt!(f.model_id, "model_id");
        flt!(f.protocol, "protocol");
        flt!(f.matrix_run_id, "matrix_run_id");
        if let Some(ref v) = f.date_from {
            vals.push(v.clone());
            sql.push_str(&format!(" AND created_at>=?{}", vals.len()));
        }
        if let Some(ref v) = f.date_to {
            vals.push(v.clone());
            sql.push_str(&format!(" AND created_at<=?{}", vals.len()));
        }
        sql.push_str(" ORDER BY created_at DESC");
        if let Some(l) = f.limit {
            sql.push_str(&format!(" LIMIT {l}"));
        }
        if let Some(o) = f.offset {
            sql.push_str(&format!(" OFFSET {o}"));
        }
        let refs: Vec<&dyn rusqlite::types::ToSql> = vals
            .iter()
            .map(|s| s as &dyn rusqlite::types::ToSql)
            .collect();
        let mut st = c.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = st
            .query_map(refs.as_slice(), |row| {
                let si: i32 = row.get(6)?;
                let cs: Option<String> = row.get(7)?;
                let checks: Vec<CheckResult> = cs
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();
                Ok(RunHistorySummary {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    model_id: row.get(2)?,
                    protocol: row.get(3)?,
                    status_code: row.get::<_, Option<i32>>(4)?.map(|v| v as u16),
                    duration_ms: row.get::<_, Option<i64>>(5)?.map(|v| v as u64),
                    stream: si != 0,
                    pass_count: checks
                        .iter()
                        .filter(|c| c.status == CheckStatus::Pass)
                        .count(),
                    fail_count: checks
                        .iter()
                        .filter(|c| c.status == CheckStatus::Fail)
                        .count(),
                    warn_count: checks
                        .iter()
                        .filter(|c| c.status == CheckStatus::Warn)
                        .count(),
                    created_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    pub fn get_run_detail(&self, id: &str) -> Result<Option<RunHistory>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut s = c.prepare("SELECT id,provider_id,model_id,protocol,test_case_id,matrix_run_id,request_snapshot,response_raw,response_parsed,status_code,error_message,duration_ms,stream,compat_results,created_at FROM run_history WHERE id=?1").map_err(|e| e.to_string())?;
        let mut rows = s
            .query_map(params![id], |row| {
                let snap: String = row.get(6)?;
                let ps: Option<String> = row.get(8)?;
                let si: i32 = row.get(12)?;
                let cs: Option<String> = row.get(13)?;
                Ok(RunHistory {
                    id: row.get(0)?,
                    provider_id: row.get(1)?,
                    model_id: row.get(2)?,
                    protocol: row.get(3)?,
                    test_case_id: row.get(4)?,
                    matrix_run_id: row.get(5)?,
                    request_snapshot: serde_json::from_str(&snap).unwrap_or_default(),
                    response_raw: row.get(7)?,
                    response_parsed: ps.and_then(|s| serde_json::from_str(&s).ok()),
                    status_code: row.get::<_, Option<i32>>(9)?.map(|v| v as u16),
                    error_message: row.get(10)?,
                    duration_ms: row.get::<_, Option<i64>>(11)?.map(|v| v as u64),
                    stream: si != 0,
                    compat_results: cs.and_then(|s| serde_json::from_str(&s).ok()),
                    created_at: row.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(r)) => Ok(Some(r)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    pub fn save_matrix_run(&self, m: &MatrixRun) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "INSERT INTO matrix_runs VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                m.id,
                m.name,
                serde_json::to_string(&m.provider_ids).unwrap_or_default(),
                serde_json::to_string(&m.model_ids).unwrap_or_default(),
                serde_json::to_string(&m.protocol_list).unwrap_or_default(),
                serde_json::to_string(&m.test_case_ids).unwrap_or_default(),
                m.status,
                m.summary.as_ref().map(|v| v.to_string()),
                m.created_at,
                m.completed_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_matrix_status(
        &self,
        id: &str,
        status: &str,
        summary: Option<&serde_json::Value>,
        completed_at: Option<&str>,
    ) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "UPDATE matrix_runs SET status=?2,summary=?3,completed_at=?4 WHERE id=?1",
            params![id, status, summary.map(|v| v.to_string()), completed_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
