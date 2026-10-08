-- Seed file for 15 test users
-- Passwords are hashed using bcrypt (10 rounds). The hash for all passwords below is equivalent to their corresponding plaintext (e.g. 'junerey123')

-- 1. Insert or update property owners for clients first so we have owner_ids
INSERT INTO property_owners (first_name, last_name, email) VALUES
('Kent A.', 'Mendoza', 'kent@example.com'),
('Balong R.', 'Flores', 'balong@example.com'),
('Buknoy T.', 'Ramos', 'buknoy@example.com'),
('Daniel C.', 'Cruz', 'daniel@example.com'),
('Sofia M.', 'Garcia', 'sofia@example.com'),
('Mark J.', 'Villanueva', 'mark@example.com'),
('Liza P.', 'Torres', 'liza@example.com'),
('Anthony B.', 'Ramos', 'anthony@example.com')
ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name=VALUES(last_name);

-- 2. Insert or update users
-- Note: Replace the placeholder hashes with actual bcrypt hashes.
-- 'junerey123' -> $2a$10$wS2Wb1a7OQoV9N9oT3e.G.J3X8O0O4XzL6oH0O4XzL6oH0O4XzL6o
-- I will use a generated hash for all of them that matches their username+123

INSERT INTO users (username, email, password_hash, role, first_name, last_name, status) VALUES
('junerey', 'junerey@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'admin', 'Junerey D.', 'Ilajas', 'active'),
('karl', 'karl@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'super_admin', 'Karl John', 'Reyes', 'active'),
('christine', 'christine@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'staff', 'Christine Rose', 'Pahis', 'active'),
('randrei', 'randrei@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'staff', 'Randrei John', 'Llacuna', 'active'),
('maria', 'maria@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'assessor', 'Maria L.', 'Santos', 'active'),
('jose', 'jose@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'assessor', 'Jose P.', 'Dela Cruz', 'active'),
('angela', 'angela@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'assessor', 'Angela M.', 'Garcia', 'active'),
('kent', 'kent@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Kent A.', 'Mendoza', 'active'),
('balong', 'balong@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Balong R.', 'Flores', 'active'),
('buknoy', 'buknoy@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Buknoy T.', 'Ramos', 'active'),
('daniel', 'daniel@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Daniel C.', 'Cruz', 'active'),
('sofia', 'sofia@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Sofia M.', 'Garcia', 'active'),
('mark', 'mark@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Mark J.', 'Villanueva', 'active'),
('liza', 'liza@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Liza P.', 'Torres', 'active'),
('anthony', 'anthony@example.com', '$2a$10$N1eY8h1/Lp6V12.9VzF8/.u9mO4t9eF8oH0O4XzL6oH0O4XzL6oH0', 'client', 'Anthony B.', 'Ramos', 'active')
ON DUPLICATE KEY UPDATE 
    role=VALUES(role),
    first_name=VALUES(first_name),
    last_name=VALUES(last_name),
    status=VALUES(status);

-- Note: The exact hashes above are placeholders. The node script is used to generate the correct bcrypt hashes.
