UPDATE boards
SET sort_order = 4
WHERE slug = 'inquiry';

INSERT INTO boards (id, slug, name, description, sort_order) VALUES
  (3, 'development', '개발', '개발 지식과 경험, 프로젝트 소식을 나누는 회원 공개 게시판입니다.', 2),
  (4, 'news', '뉴스', '새로운 소식과 주요 이슈를 함께 나누는 회원 공개 게시판입니다.', 3);
