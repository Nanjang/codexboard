CREATE INDEX idx_visitor_page_views_visited_ip
  ON visitor_page_views(visited_at, ip_address);
