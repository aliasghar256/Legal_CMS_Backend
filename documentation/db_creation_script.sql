CREATE TABLE courts (
  court_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  type VARCHAR(100),
  location VARCHAR(255)
);

CREATE TABLE cases (
  case_id SERIAL PRIMARY KEY,
  case_number VARCHAR(255),
  court_id INT REFERENCES courts(court_id),
  court_name VARCHAR(255),
  case_type VARCHAR(100),
  legal_section VARCHAR(255),
  filing_date DATE,
  status VARCHAR(100),
  stage VARCHAR(100),
  description TEXT
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
  diary_entry TEXT,
  type VARCHAR(100),
  next_hearing_date DATE
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
  contact_info TEXT
);

CREATE TABLE lawyers (
  lawyer_id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  license_no VARCHAR(50),
  contact_info TEXT
);

CREATE TABLE case_lawyers (
  case_id INT REFERENCES cases(case_id),
  lawyer_id INT REFERENCES lawyers(lawyer_id),
  party_id INT REFERENCES parties(party_id),
  PRIMARY KEY (case_id, lawyer_id, party_id)
);

CREATE TABLE case_parties (
  case_id INT REFERENCES cases(case_id),
  party_id INT REFERENCES parties(party_id),
  PRIMARY KEY (case_id, party_id)
);

CREATE TABLE case_links (
  link_id SERIAL PRIMARY KEY,
  case_id_1 INT REFERENCES cases(case_id),
  case_id_2 INT REFERENCES cases(case_id),
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

CREATE TABLE diary_entries (
  entry_id SERIAL PRIMARY KEY,
  case_id INT REFERENCES cases(case_id),
  sequence_no INT,
  entry_date DATE,
  text TEXT
);
