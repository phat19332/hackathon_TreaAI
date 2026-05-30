# Cyberpunk Detective Terminal (React + Vite + Tailwind + Express)

Single-page UI theo phong cách “Dark Police Terminal” + server Express đóng vai trò Game Master.

## Tech stack

- Frontend: React + TypeScript + Tailwind CSS + lucide-react
- Backend: Express + cors
- Dev proxy: Vite proxy `/api -> http://localhost:5000`

## Chạy dự án

Cài dependencies:

```bash
npm install
```

Chạy backend (Game Master API):

```bash
npm run server
```

Chạy frontend:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

## API

### POST /api/turn

Body:

```json
{ "user_input": "...", "session_id": "optional" }
```

Response:

```json
{
  "status": "success|failed",
  "message": "AI-SYS: ...",
  "unlock_next": true,
  "session_id": "uuid",
  "next_scene_id": "optional",
  "objective": "optional",
  "video_url": "optional"
}
```

Luồng xử lý:

- Server giữ `session` (scene hiện tại) để điều phối theo story graph, tránh AI tự bịa scene ngoài kịch bản.
- Nếu `unlock_next: true`, server giả lập “kết nối PixVerse” bằng `setTimeout` ~3 giây rồi mới trả về `video_url` (link tĩnh) để demo mượt và ổn định.

Fallback logic hiện tại (keyword-based): nếu `user_input` (lowercase) chứa một trong: `chip`, `gáy`, `khe cắm`, `rút`, `tdt` thì unlock scene kế tiếp.

### POST /api/investigate (legacy)

Giữ lại để tương thích nhanh với bản demo trước (không session, không video job).

## Video assets

UI sẽ phát video theo state (được server điều phối theo scene):

- Mặc định: `/videos/video1.mp4`
- Khi unlock scene kế tiếp (server delay 3s): đổi sang video mới (ví dụ `/videos/video2.mp4`)

Đặt 2 file này trong thư mục `public/videos/` để chạy ngay.

## Story graph (chống lệch cốt truyện)

Server có một story graph tối giản gồm các scene và “allowed next scenes”. Khi người chơi gửi input:

- Scene hiện tại quyết định có được unlock hay không (fallback keyword).
- Nếu unlock: server chỉ cho phép chuyển sang scene nằm trong danh sách cho phép, rồi tạo một `video job`.

Khi bạn có “cốt truyện chính”, bạn chỉ cần mở rộng graph này (thêm scene + điều kiện + constraints) để đảm bảo không mâu thuẫn.

## PixavAI integration (mô hình)

Hiện tại server đang mô phỏng PixVerse/PixavAI bằng cách delay 3 giây rồi trả về link video tĩnh. Khi tích hợp PixVerse/PixavAI thật:

- Thay `setTimeout` trong `POST /api/turn` bằng call PixVerse/PixavAI (enqueue/generate)
- Trả về `video_url` là URL thật (CDN/storage) khi video hoàn tất

## Nơi gắn TRAE và PixVerse/PixavAI

- TRAE (logic hội thoại thám tử): thay phần `callTraeAI(...)` trong [server/index.js](file:///d:/Apps/hackathon_TraeAI/server/index.js) bằng API call thật của TRAE (giữ output dạng `{ unlockNext, nextSceneId, message }`).
- PixVerse/PixavAI (tạo video): hiện đang được giả lập trong `POST /api/turn` bằng `await sleep(3000)` và trả `video_url` tĩnh. Khi tích hợp thật, thay đoạn này bằng call generate video và set `video_url` theo kết quả.
## Gợi ý tính năng tiếp theo

- Visual Novel flow: scene graph (nodes/choices), lịch sử lựa chọn, auto-save/checkpoints.
- Hệ thống “Clues Database”: tìm kiếm, tag, mức độ tin cậy, link quan hệ (graph) giữa manh mối.
- Inventory/Tools: dùng vật phẩm để mở khóa keyword/branch, cooldown và durability.
- Terminal command system: autocomplete, command history (↑/↓), slash commands (`/help`, `/clues`, `/objective`).
- Audio/UX: typing SFX, CRT hum, alert beep; “typewriter effect” cho AI message; phím tắt (Tab focus, Esc clear).
- Telemetry/game analytics: log event (không chứa PII) cho QA và cân bằng độ khó.

## Gợi ý tối ưu

- Tách “log render” thành component con + dùng `React.memo` để tránh rerender toàn bộ layout khi gõ input.
- Dùng `useReducer` cho `chatLogs` khi bắt đầu có nhiều action (append, replace pending, rollback, etc.).
- Thêm request cancel: dùng `AbortController` để hủy request khi người chơi gửi liên tiếp.
- Giới hạn log: giữ tối đa N dòng (ví dụ 200) để tránh DOM quá lớn, hoặc dùng virtualization.
- Backend: validate payload + rate limit cơ bản; chuẩn hóa response schema; chuẩn bị thay fallback bằng LLM qua adapter.
