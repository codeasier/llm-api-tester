use std::collections::HashMap;
use std::sync::Mutex;

const SERVICE_NAME: &str = "llm-api-tester";

pub struct KeyStore {
    memory_keys: Mutex<HashMap<String, String>>,
}

impl KeyStore {
    pub fn new() -> Self {
        KeyStore {
            memory_keys: Mutex::new(HashMap::new()),
        }
    }

    pub fn store_secure(&self, provider_id: &str, key: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| format!("keyring init error: {e}"))?;
        entry
            .set_password(key)
            .map_err(|e| format!("keyring store error: {e}"))
    }

    pub fn get_secure(&self, provider_id: &str) -> Result<Option<String>, String> {
        let entry = keyring::Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| format!("keyring init error: {e}"))?;
        match entry.get_password() {
            Ok(pw) => Ok(Some(pw)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("keyring get error: {e}")),
        }
    }

    pub fn delete_secure(&self, provider_id: &str) -> Result<(), String> {
        let entry = keyring::Entry::new(SERVICE_NAME, provider_id)
            .map_err(|e| format!("keyring init error: {e}"))?;
        match entry.delete_credential() {
            Ok(()) => Ok(()),
            Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("keyring delete error: {e}")),
        }
    }

    pub fn store_memory(&self, provider_id: &str, key: &str) {
        self.memory_keys
            .lock()
            .unwrap()
            .insert(provider_id.to_string(), key.to_string());
    }

    pub fn get_memory(&self, provider_id: &str) -> Option<String> {
        self.memory_keys.lock().unwrap().get(provider_id).cloned()
    }

    pub fn delete_memory(&self, provider_id: &str) {
        self.memory_keys.lock().unwrap().remove(provider_id);
    }
}
