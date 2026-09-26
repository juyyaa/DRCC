-- ============================================================
-- DRCC — Database Schema (MariaDB)
-- AI Disaster Response Command Center
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. USERS & AUTH
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','operator','relawan','pemda') NOT NULL DEFAULT 'relawan',
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(150) NULL,
  phone         VARCHAR(30)  NULL,
  province      VARCHAR(100) NULL COMMENT 'wilayah kerja, relevan utk pemda/relawan',
  status        ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  user_agent  VARCHAR(255) NULL,
  ip_address  VARCHAR(45)  NULL,
  expires_at  DATETIME NOT NULL,
  revoked     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token_hash (token_hash),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2. INCIDENTS (Layer 5: User Action)
-- ============================================================
CREATE TABLE IF NOT EXISTS incidents (
  id                  VARCHAR(20) PRIMARY KEY COMMENT 'e.g. INC-001',
  title               VARCHAR(200) NOT NULL,
  type                VARCHAR(50)  NOT NULL COMMENT 'gempa, banjir, longsor, kebakaran, lainnya',
  location            VARCHAR(150) NOT NULL,
  province            VARCHAR(100) NOT NULL,
  lat                 DECIMAL(10,6) NOT NULL,
  lng                 DECIMAL(10,6) NOT NULL,
  severity            ENUM('NORMAL','WASPADA','SIAGA','BAHAYA') NOT NULL DEFAULT 'NORMAL',
  status              ENUM('aktif','ditangani','selesai') NOT NULL DEFAULT 'aktif',
  description         TEXT NULL,
  reporter_name       VARCHAR(120) NULL,
  reporter_phone      VARCHAR(30)  NULL,
  affected_population INT UNSIGNED NOT NULL DEFAULT 0,
  signal_origin       VARCHAR(50)  NULL COMMENT 'scenario_id or signal_id that triggered this',
  created_by          INT UNSIGNED NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_province (province),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3. RESOURCES (Sumber Daya)
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id           VARCHAR(20) PRIMARY KEY COMMENT 'e.g. RES-001',
  name         VARCHAR(150) NOT NULL,
  type         VARCHAR(50)  NOT NULL COMMENT 'Helikopter, Truk, Perahu, Ambulans, Relawan, Logistik',
  quantity     INT UNSIGNED NOT NULL DEFAULT 1,
  status       ENUM('tersedia','deployed','maintenance') NOT NULL DEFAULT 'tersedia',
  location     VARCHAR(150) NULL,
  assigned_to  VARCHAR(20)  NULL COMMENT 'incident id',
  notes        TEXT NULL,
  created_by   INT UNSIGNED NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES incidents(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_status (status),
  INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4. SIGNALS (Layer 1: Input Signal)
-- ============================================================
CREATE TABLE IF NOT EXISTS signals (
  id          VARCHAR(20) PRIMARY KEY COMMENT 'e.g. SIG-001',
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(50)  NOT NULL COMMENT 'gempa, cuaca, cctv, sosmed, relawan, pengungsian, logistik',
  unit        VARCHAR(20)  NULL,
  source      VARCHAR(100) NULL COMMENT 'BMKG, PUSAIR, Twitter, dll',
  status      ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  lat         DECIMAL(10,6) NULL,
  lng         DECIMAL(10,6) NULL,
  current_value DECIMAL(12,3) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5. SIGNAL PROCESSING LOG (Layer 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS signal_events (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  signal_id        VARCHAR(20) NOT NULL,
  signal_name      VARCHAR(150) NOT NULL,
  raw_value        DECIMAL(12,3) NOT NULL,
  filtered_value   DECIMAL(12,3) NOT NULL,
  features         JSON NULL,
  anomaly          TINYINT(1) NOT NULL DEFAULT 0,
  anomaly_level    ENUM('NORMAL','WASPADA','SIAGA','BAHAYA') NOT NULL DEFAULT 'NORMAL',
  priority_score   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  processing_steps JSON NULL,
  source           VARCHAR(100) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE,
  INDEX idx_signal (signal_id),
  INDEX idx_anomaly (anomaly),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS anomalies (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  signal_id    VARCHAR(20) NOT NULL,
  signal_name  VARCHAR(150) NOT NULL,
  value        DECIMAL(12,3) NOT NULL,
  threshold    DECIMAL(12,3) NOT NULL,
  level        ENUM('WASPADA','SIAGA','BAHAYA') NOT NULL,
  signal_type  VARCHAR(50) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (signal_id) REFERENCES signals(id) ON DELETE CASCADE,
  INDEX idx_level (level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6. AI ANALYSIS (Layer 3 & 4)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_analyses (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NULL,
  input_data      JSON NOT NULL,
  risk_score      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  risk_level      ENUM('NORMAL','WASPADA','SIAGA','BAHAYA') NOT NULL DEFAULT 'NORMAL',
  area_data       JSON NULL,
  casualty_data   JSON NULL,
  confidence_data JSON NULL,
  decisions       JSON NULL,
  scenario_id     VARCHAR(20) NULL,
  ai_provider     VARCHAR(30) NOT NULL DEFAULT 'gemini',
  raw_ai_response LONGTEXT NULL COMMENT 'full text response dari Gemini API',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_risk_level (risk_level),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_reasoning_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id  BIGINT UNSIGNED NOT NULL,
  agent_id     VARCHAR(20) NOT NULL COMMENT 'aria, logi, recon, pulse',
  agent_name   VARCHAR(50) NOT NULL,
  full_name    VARCHAR(100) NULL,
  steps        JSON NOT NULL,
  confidence   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  conclusion   TEXT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
  INDEX idx_analysis (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_coordination (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id  BIGINT UNSIGNED NOT NULL,
  messages     JSON NOT NULL,
  consensus    JSON NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
  INDEX idx_analysis (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ai_decisions (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  analysis_id   BIGINT UNSIGNED NULL,
  input_data    JSON NOT NULL,
  fired_rules   JSON NOT NULL,
  top_rule      JSON NULL,
  all_rules     JSON NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id) ON DELETE CASCADE,
  INDEX idx_analysis (analysis_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7. SITUATION MAP MARKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS map_markers (
  id          VARCHAR(20) PRIMARY KEY COMMENT 'e.g. MRK-001',
  name        VARCHAR(150) NOT NULL,
  type        VARCHAR(50)  NOT NULL COMMENT 'gempa, banjir, posko, depot, dll',
  category    ENUM('disaster','posko','depot') NOT NULL DEFAULT 'disaster',
  severity    ENUM('NORMAL','WASPADA','SIAGA','BAHAYA') NULL,
  lat         DECIMAL(10,6) NOT NULL,
  lng         DECIMAL(10,6) NOT NULL,
  description TEXT NULL,
  marker_date DATE NULL,
  incident_id VARCHAR(20) NULL,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_type (type),
  INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8. ACTIVITY LOG (semua layer)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL,
  action      VARCHAR(255) NOT NULL,
  layer       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  layer_name  VARCHAR(100) NULL,
  data        JSON NULL,
  page        VARCHAR(50) NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_layer (layer),
  INDEX idx_user (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9. NOTIFICATIONS (real-time via WebSocket + persisted)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NULL COMMENT 'NULL = broadcast ke semua user',
  target_role ENUM('admin','operator','relawan','pemda','all') NOT NULL DEFAULT 'all',
  type        ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  title       VARCHAR(200) NOT NULL,
  message     TEXT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_target_role (target_role),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10. EVIDENCE & SCENARIO RUNS (Demo Center / UAS bukti)
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  type        VARCHAR(50) NOT NULL,
  layer       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  data        JSON NULL,
  user_id     INT UNSIGNED NULL,
  page        VARCHAR(50) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_type (type),
  INDEX idx_layer (layer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS scenario_runs (
  id            VARCHAR(30) PRIMARY KEY,
  scenario_id   VARCHAR(20) NOT NULL,
  user_id       INT UNSIGNED NULL,
  steps         JSON NULL,
  complete      TINYINT(1) NOT NULL DEFAULT 0,
  completed_at  DATETIME NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_scenario (scenario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 11. SETTINGS (per-user)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  user_id     INT UNSIGNED PRIMARY KEY,
  notif       JSON NULL,
  display     JSON NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
