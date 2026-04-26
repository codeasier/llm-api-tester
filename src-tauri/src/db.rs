use crate::models::*;
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    pub(crate) conn: Mutex<Connection>,
}

impl Database {
    pub fn new(path: &Path) -> Result<Self, String> {
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(include_str!("schema.sql"))
            .map_err(|e| e.to_string())
    }

    pub fn create_provider(&self, p: &ProviderConfig) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "INSERT INTO providers VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![
                p.id,
                p.name,
                p.base_url,
                p.headers.to_string(),
                serde_json::to_string(&p.models).unwrap_or_default(),
                p.key_storage.to_string(),
                p.created_at,
                p.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_provider(&self, p: &ProviderConfig) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute("UPDATE providers SET name=?2,base_url=?3,headers=?4,models=?5,key_storage=?6,updated_at=?7 WHERE id=?1",
            params![p.id, p.name, p.base_url, p.headers.to_string(),
                    serde_json::to_string(&p.models).unwrap_or_default(),
                    p.key_storage.to_string(), p.updated_at]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_provider(&self, id: &str) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let affected = c
            .execute("DELETE FROM providers WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        if affected == 0 {
            return Err("Provider not found".into());
        }
        Ok(())
    }

    pub fn list_providers(&self) -> Result<Vec<ProviderConfig>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut s = c.prepare("SELECT id,name,base_url,headers,models,key_storage,created_at,updated_at FROM providers ORDER BY created_at").map_err(|e| e.to_string())?;
        let r = s
            .query_map([], |row| {
                let h: String = row.get(3)?;
                let m: String = row.get(4)?;
                let k: String = row.get(5)?;
                Ok(ProviderConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    base_url: row.get(2)?,
                    headers: serde_json::from_str(&h).unwrap_or_default(),
                    models: serde_json::from_str(&m).unwrap_or_default(),
                    key_storage: k.parse().unwrap_or(KeyStorage::Secure),
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;
        r.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn get_provider(&self, id: &str) -> Result<Option<ProviderConfig>, String> {
        let list = self.list_providers()?;
        Ok(list.into_iter().find(|p| p.id == id))
    }

    pub fn save_test_case(&self, tc: &TestCase) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "INSERT OR REPLACE INTO test_cases VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![
                tc.id,
                tc.name,
                tc.protocol,
                tc.request_body.to_string(),
                tc.stream as i32,
                tc.description,
                serde_json::to_string(&tc.tags).unwrap_or_default(),
                tc.created_at,
                tc.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_test_cases(&self) -> Result<Vec<TestCase>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut s = c.prepare("SELECT id,name,protocol,request_body,stream,description,tags,created_at,updated_at FROM test_cases ORDER BY created_at").map_err(|e| e.to_string())?;
        let r = s
            .query_map([], |row| {
                let b: String = row.get(3)?;
                let si: i32 = row.get(4)?;
                let t: String = row.get(6)?;
                Ok(TestCase {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    protocol: row.get(2)?,
                    request_body: serde_json::from_str(&b).unwrap_or_default(),
                    stream: si != 0,
                    description: row.get(5)?,
                    tags: serde_json::from_str(&t).unwrap_or_default(),
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })
            .map_err(|e| e.to_string())?;
        r.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_test_case(&self, id: &str) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute("DELETE FROM test_cases WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_test_suite(&self, ts: &TestSuite) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute(
            "INSERT OR REPLACE INTO test_suites VALUES (?1,?2,?3,?4,?5)",
            params![
                ts.id,
                ts.name,
                serde_json::to_string(&ts.test_case_ids).unwrap_or_default(),
                ts.created_at,
                ts.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_test_suites(&self) -> Result<Vec<TestSuite>, String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        let mut s = c.prepare("SELECT id,name,test_case_ids,created_at,updated_at FROM test_suites ORDER BY created_at").map_err(|e| e.to_string())?;
        let r = s
            .query_map([], |row| {
                let ids: String = row.get(2)?;
                Ok(TestSuite {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    test_case_ids: serde_json::from_str(&ids).unwrap_or_default(),
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        r.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_test_suite(&self, id: &str) -> Result<(), String> {
        let c = self.conn.lock().map_err(|e| e.to_string())?;
        c.execute("DELETE FROM test_suites WHERE id=?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
