-- Fix search_path for update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Fix search_path for generate_ecell_id function
CREATE OR REPLACE FUNCTION generate_ecell_id()
RETURNS TRIGGER AS $$
DECLARE
  year_suffix TEXT;
  counter INTEGER;
  new_id TEXT;
BEGIN
  year_suffix := TO_CHAR(CURRENT_DATE, 'YY');
  
  SELECT COUNT(*) + 1 INTO counter
  FROM profiles
  WHERE ecell_id LIKE 'ECELL' || year_suffix || '%';
  
  new_id := 'ECELL' || year_suffix || '-' || LPAD(counter::TEXT, 3, '0');
  NEW.ecell_id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;