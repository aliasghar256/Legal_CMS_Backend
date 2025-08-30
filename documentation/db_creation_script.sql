CREATE TABLE courts (
  court_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(100),
  location VARCHAR(255)
);

CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,
  email TEXT,
  password TEXT,
  name VARCHAR(255),
  license_no VARCHAR(255),
  phone_number VARCHAR(255)
);

CREATE TABLE cases (
  case_id SERIAL PRIMARY KEY,
  case_number TEXT,
  court_id INT REFERENCES courts(court_id),
  court_name VARCHAR(255),
  case_type VARCHAR(100),
  legal_section TEXT,
  filing_date DATE,
  status VARCHAR(100),
  stage VARCHAR(100),
  description TEXT,
  next_hearing DATE,
  cfms_case_code VARCHAR(255)
);

CREATE TABLE judges (
  judge_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  designation VARCHAR(100),
  court_id INT REFERENCES courts(court_id)
);

CREATE TABLE hearings (
  hearing_id SERIAL PRIMARY KEY,
  case_id INT REFERENCES cases(case_id),
  judge_id INT REFERENCES judges(judge_id),
  date DATE,
  description TEXT,
  type VARCHAR(100)
);

CREATE TABLE documents (
  document_id SERIAL PRIMARY KEY,
  case_id INT REFERENCES cases(case_id),
  type VARCHAR(100),
  file_path TEXT,
  uploaded_by INT,
  date_uploaded DATE
);

CREATE TABLE parties (
  party_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  cnic VARCHAR(20),
  role VARCHAR(100),
  email VARCHAR(255),
  phone_number VARCHAR(255)
);

CREATE TABLE lawyers (
  lawyer_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  license_no VARCHAR(50),
  email VARCHAR(255),
  phone_number VARCHAR(255)
);

CREATE TABLE case_lawyers (
  case_id INT REFERENCES cases(case_id),
  lawyer_id INT REFERENCES lawyers(lawyer_id),
  party_id INT REFERENCES parties(party_id),
  user_id INT REFERENCES users(user_id),
  PRIMARY KEY (case_id, lawyer_id, party_id)
);

CREATE TABLE user_lawyers (
  user_id INT REFERENCES users(user_id),
  lawyer_id INT REFERENCES lawyers(lawyer_id)
);

CREATE TABLE user_parties (
  user_id INT REFERENCES users(user_id),
  party_id INT REFERENCES parties(party_id)
);

CREATE TABLE case_parties (
  case_id INT REFERENCES cases(case_id),
  party_id INT REFERENCES parties(party_id),
  PRIMARY KEY (case_id, party_id)
);

CREATE TABLE case_links (
  link_id SERIAL PRIMARY KEY,
  parent_case_id INT REFERENCES cases(case_id),
  child_case_id INT REFERENCES cases(case_id),
  link_type VARCHAR(100),
  notes TEXT,
  created_at DATE DEFAULT CURRENT_DATE
);

CREATE TABLE case_references (
  case_id INT REFERENCES cases(case_id),
  cited_case_id INT REFERENCES cases(case_id),
  reference_note TEXT,
  PRIMARY KEY (case_id, cited_case_id)
);

CREATE TABLE reminders (
  reminder_id INT PRIMARY KEY,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(255) NOT NULL DEFAULT 'scheduled',
  note TEXT
);

CREATE TABLE user_reminders (
  user_id INT NOT NULL REFERENCES users(user_id),
  case_id INT NOT NULL REFERENCES cases(case_id),
  hearing_id INT REFERENCES hearings(hearing_id),
  reminder_id INT NOT NULL REFERENCES reminders(reminder_id)
);

CREATE TABLE email_reminders (
  email_id INT NOT NULL,
  reminder_id INT NOT NULL REFERENCES reminders(reminder_id),
  subject VARCHAR(255),
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  response TEXT
);

CREATE TABLE whatsapp_reminders (
  whatsapp_id INT NOT NULL,
  reminder_id INT NOT NULL REFERENCES reminders(reminder_id),
  message TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(255) NOT NULL DEFAULT 'pending',
  response TEXT
);
