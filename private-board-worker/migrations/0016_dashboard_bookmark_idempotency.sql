ALTER TABLE dashboard_widgets
ADD COLUMN create_request_id TEXT
CHECK (
  create_request_id IS NULL
  OR length(create_request_id) = 36
);

CREATE UNIQUE INDEX idx_dashboard_widgets_user_create_request
  ON dashboard_widgets(user_id, create_request_id)
  WHERE create_request_id IS NOT NULL;
