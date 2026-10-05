# SmartMed Cycle — Implementation Tasks

**Version:** 1.0  
**Date:** 2025  

---

## Dependency Graph / Execution Waves

Tasks are grouped into **waves** that can proceed in parallel within each wave. A wave must be substantially complete before the next wave starts.

```
Wave 1 — Foundation (no dependencies)
  Task 1: Project scaffolding
  Task 2: Backend skeleton

Wave 2 — Core AI layer (depends on Wave 1)
  Task 3: Bedrock integration + shared helpers
  Task 4: AppContext + global state

Wave 3 — Section backends (depends on Wave 2)
  Task 5: /api/medicine-card endpoint
  Task 6: /api/precautions endpoint
  Task 7: /api/chat endpoint
  Task 8: /api/return-plan endpoint

Wave 4 — Section frontends (depends on Wave 3)
  Task 9:  Section 1 — Understand My Medicine UI
  Task 10: Section 2 — Check My Precautions UI
  Task 11: Section 3 — SmartMed Help chat UI
  Task 12: Section 4 — Return Unused Medicines UI

Wave 5 — Integration & polish (depends on Wave 4)
  Task 13: Cross-section wiring + staleness logic
  Task 14: Accessibility audit and fixes
  Task 15: Responsive layout polish

Wave 6 — Validation (depends on Wave 5)
  Task 16: End-to-end testing
  Task 17*: Streaming responses (optional enhancement)
```

`*` = Optional task

---

## Task 1 — Project Scaffolding

**Wave:** 1  
**Depends on:** nothing  
**Goal:** Create the full directory structure and install base dependencies for both client and server.

### Sub-tasks

- [ ] 1.1 Create root directory `smartmed-cycle/` with a top-level `.gitignore` that excludes `node_modules/`, `.env`, and `dist/`
- [ ] 1.2 Scaffold the frontend with Vite: `npm create vite@latest client -- --template react`
- [ ] 1.3 Install frontend dependencies: `npm install` in `client/`
- [ ] 1.4 Install Tailwind CSS in the client: `npm install -D tailwindcss postcss autoprefixer` + `npx tailwindcss init -p`
- [ ] 1.5 Configure `tailwind.config.js` with `content` paths covering `./src/**/*.{js,jsx}`
- [ ] 1.6 Add Tailwind directives to `client/src/index.css`
- [ ] 1.7 Create `server/` directory and run `npm init -y` inside it
- [ ] 1.8 Install server dependencies: `express`, `dotenv`, `cors`, `multer` (or use express.json for Base64), `@aws-sdk/client-bedrock-runtime`
- [ ] 1.9 Create `.env` file at the project root (or `server/.env`) with placeholders: `AWS_ACCESS_KEY_ID=`, `AWS_SECRET_ACCESS_KEY=`, `AWS_REGION=`
- [ ] 1.10 Add Vite proxy config to `client/vite.config.js` — proxy `/api` to `http://localhost:3001`
- [ ] 1.11 Add Inter font to `client/index.html` via Google Fonts `<link>`
- [ ] 1.12 Create the full directory tree for components and routes as specified in the design document

**Acceptance criteria:** Running `npm run dev` in `client/` opens a blank Vite/React page; running `node server.js` in `server/` starts without errors.

---

## Task 2 — Backend Skeleton

**Wave:** 1  
**Depends on:** nothing (can run in parallel with Task 1)  
**Goal:** Set up a working Express server with health check, CORS, JSON body parsing, and route stubs.

### Sub-tasks

- [ ] 2.1 Create `server/server.js` with:
  - `require('dotenv').config()` at the top
  - Express app initialisation
  - CORS middleware allowing `http://localhost:5173` (Vite dev port)
  - `express.json({ limit: '10mb' })` body parser (to accept Base64 image strings)
  - Mount route stubs: `/api/medicine-card`, `/api/precautions`, `/api/chat`, `/api/return-plan`
  - `app.listen(3001, ...)`
- [ ] 2.2 Create route stub files: `server/routes/medicine.js`, `server/routes/chat.js`, `server/routes/returnPlan.js` — each exporting an Express router with placeholder `POST` handlers that return `{ "status": "ok" }`
- [ ] 2.3 Add a `GET /api/health` route that returns `{ "status": "ok", "model": "claude-3-haiku" }`
- [ ] 2.4 Add a `start` script to `server/package.json`: `"start": "node server.js"` and a `dev` script using `nodemon`: `"dev": "nodemon server.js"`
- [ ] 2.5 Validate: `curl http://localhost:3001/api/health` returns `{"status":"ok"}`

**Acceptance criteria:** All four route stubs return 200 with stub JSON; server starts cleanly with no credential errors.

---

## Task 3 — Bedrock Integration and Shared Helpers

**Wave:** 2  
**Depends on:** Task 2  
**Goal:** Create a reusable Bedrock client and `invokeModel` helper that all route handlers can import.

### Sub-tasks

- [ ] 3.1 Create `server/bedrock.js` that initialises `BedrockRuntimeClient` using environment variables
- [ ] 3.2 Implement `invokeModel(messages, systemPrompt)` function — builds the Anthropic message body, calls `InvokeModelCommand`, parses and returns the text response
- [ ] 3.3 Implement `invokeModelWithImage(textPrompt, systemPrompt, imageBase64, imageMimeType)` function — builds a vision message with both `image` and `text` content blocks
- [ ] 3.4 Define the `MODEL_ID` constant: `"anthropic.claude-3-haiku-20240307-v1:0"`
- [ ] 3.5 Add `max_tokens: 1024` as the default, exported as a configurable constant `MAX_TOKENS`
- [ ] 3.6 Wrap all Bedrock calls in try/catch; throw a typed `BedrockError` with a `userMessage` field for clean API error responses
- [ ] 3.7 Write a quick manual test: create `server/test-bedrock.js` that calls `invokeModel` with a simple "Say hello" prompt and logs the response; delete after confirming it works

**Acceptance criteria:** `invokeModel` successfully returns a text response from Claude 3 Haiku; `invokeModelWithImage` correctly formats the vision payload.

---

## Task 4 — AppContext and Global Frontend State

**Wave:** 2  
**Depends on:** Task 1  
**Goal:** Set up the React context that shares Medicine Card, My Medicine Summary, and Preferred Language across all sections.

### Sub-tasks

- [ ] 4.1 Create `client/src/context/AppContext.jsx` with `React.createContext`
- [ ] 4.2 Define `AppProvider` component that uses `useState` to manage: `medicineCard`, `medicineCardVersion`, `preferredLanguage`, `medicineSummary`, `medicineSummaryVersion`, `chatHistory`
- [ ] 4.3 Export `useAppContext` custom hook: `const useAppContext = () => useContext(AppContext)`
- [ ] 4.4 Wrap `<App>` in `<AppProvider>` in `client/src/main.jsx`
- [ ] 4.5 Set default `preferredLanguage` to `"English"` and `chatHistory` to the initial greeting message
- [ ] 4.6 Define the initial greeting message object: `{ role: "assistant", content: "Hi! 👋 I'm SmartMed Help. Ask me anything about your medicine." }`

**Acceptance criteria:** `useAppContext()` is accessible from any component; initial chat history renders the greeting in Section 3.

---

## Task 5 — Backend: /api/medicine-card Endpoint

**Wave:** 3  
**Depends on:** Task 3  
**Goal:** Implement the endpoint that generates the Medicine Card.

### Sub-tasks

- [ ] 5.1 In `server/routes/medicine.js`, implement `POST /medicine-card`
- [ ] 5.2 Validate request body: at least one of `medicineDetails` or `imageBase64` must be present; return 400 if neither is provided
- [ ] 5.3 If `imageBase64` is present, validate `imageMimeType` is one of `image/jpeg`, `image/png`, `image/webp`; return 400 if invalid
- [ ] 5.4 Build the system prompt using the `preferredLanguage` and `patientAge` from the request (use the template from design.md §6.1)
- [ ] 5.5 Build the user message: if both text and image provided, use the comparison prompt; if image only, use the extraction prompt; if text only, use the text-only prompt
- [ ] 5.6 Call `invokeModel` or `invokeModelWithImage` from `server/bedrock.js`
- [ ] 5.7 Return `{ "medicineCard": responseText }` on success
- [ ] 5.8 Handle `BedrockError` — return 500 with `{ "error": "Could not generate Medicine Card. Please try again." }`
- [ ] 5.9 Test with Postman or curl: text-only, image-only, and combined requests

**Acceptance criteria:** All three input modes return a populated Medicine Card; errors return appropriate HTTP status codes.

---

## Task 6 — Backend: /api/precautions Endpoint

**Wave:** 3  
**Depends on:** Task 3  
**Goal:** Implement the endpoint that generates My Medicine Summary.

### Sub-tasks

- [ ] 6.1 In `server/routes/medicine.js`, implement `POST /precautions`
- [ ] 6.2 Validate that `medicineCard` is present in the request body; return 400 if missing
- [ ] 6.3 Build system and user prompts using the template from design.md §6.2, substituting `medicineCard`, `otherMedicines` (or "Not provided"), `allergies` (or "Not provided"), and `preferredLanguage`
- [ ] 6.4 Call `invokeModel` and return `{ "medicineSummary": responseText }`
- [ ] 6.5 Handle errors with 500 + generic message
- [ ] 6.6 Test: call with a sample Medicine Card and verify the output is a structured list of precaution points

**Acceptance criteria:** Returns a populated My Medicine Summary; handles missing `otherMedicines`/`allergies` gracefully.

---

## Task 7 — Backend: /api/chat Endpoint

**Wave:** 3  
**Depends on:** Task 3  
**Goal:** Implement the SmartMed Help chat endpoint.

### Sub-tasks

- [ ] 7.1 In `server/routes/chat.js`, implement `POST /chat`
- [ ] 7.2 Validate that `message` is present; return 400 if missing
- [ ] 7.3 Build the system prompt from design.md §6.3, injecting `preferredLanguage`, `medicineCard` (or "Not provided"), `medicineSummary` (or "Not provided")
- [ ] 7.4 Construct the messages array from `history` (past turns) plus the new `message`
- [ ] 7.5 Call `invokeModel` with the constructed messages and system prompt
- [ ] 7.6 Return `{ "reply": responseText }`
- [ ] 7.7 Handle errors with 500 + generic message
- [ ] 7.8 Test: verify QUIZ MODE trigger ("quiz me") returns quiz-formatted output; verify PHARMACIST SUMMARY trigger returns the correct block
- [ ] 7.9 Test emergency trigger: send a message with "chest pain" and verify the escalation response

**Acceptance criteria:** Chat returns contextual replies; QUIZ MODE and PHARMACIST SUMMARY triggers produce the expected outputs; emergency escalation fires correctly.

---

## Task 8 — Backend: /api/return-plan Endpoint

**Wave:** 3  
**Depends on:** Task 3  
**Goal:** Implement the endpoint that generates My Return Plan.

### Sub-tasks

- [ ] 8.1 In `server/routes/returnPlan.js`, implement `POST /return-plan`
- [ ] 8.2 Validate that `location` and `returnDetails` are present; return 400 if either is missing
- [ ] 8.3 Build system and user prompts from design.md §6.4, substituting `location`, `returnDetails`, and `preferredLanguage`
- [ ] 8.4 If `imageBase64` is present, call `invokeModelWithImage`; otherwise call `invokeModel`
- [ ] 8.5 Return `{ "returnPlan": responseText }`
- [ ] 8.6 Handle errors with 500 + generic message
- [ ] 8.7 Test with and without image input

**Acceptance criteria:** Returns a populated return plan that mentions myMediSAFE and the stop-taking warning.

---

## Task 9 — Frontend: Section 1 — Understand My Medicine

**Wave:** 4  
**Depends on:** Tasks 4, 5  
**Goal:** Build the full Section 1 UI: form inputs, image upload with preview, loading state, and Medicine Card display.

### Sub-tasks

- [ ] 9.1 Create `client/src/components/Section1_UnderstandMedicine.jsx`
- [ ] 9.2 Implement the form layout with Tailwind: `MedicineDetailsInput` (textarea), `LanguageSelect` (dropdown), `PatientAgeInput` (text input), `PhotoUpload` (file input)
- [ ] 9.3 Wire `LanguageSelect` to update `preferredLanguage` in AppContext on change
- [ ] 9.4 Implement `PhotoUpload`: on file selection, validate MIME type and size (<5 MB); use `FileReader.readAsDataURL` to get Base64; show a thumbnail preview; strip the data URL prefix before storing
- [ ] 9.5 Implement the "Generate Medicine Card" button with loading spinner — disable during API call
- [ ] 9.6 On submit, POST to `/api/medicine-card` with `medicineDetails`, `patientAge`, `preferredLanguage`, `imageBase64`, `imageMimeType`
- [ ] 9.7 On success, call `setMedicineCard(responseText)` and increment `medicineCardVersion`
- [ ] 9.8 Render the `MedicineCard` output in a styled card below the form (green left border, white background)
- [ ] 9.9 Display the persistent reminder: *"Compare the Medicine Card with your original label before continuing to Section 2."*
- [ ] 9.10 Display inline validation error if submit is clicked with no input
- [ ] 9.11 Display API error in an `aria-live="polite"` region; offer a "Try again" button
- [ ] 9.12 Add accessible `<label>` elements for all inputs; ensure keyboard tab order is logical

**Acceptance criteria:** Full Section 1 flow works end-to-end; Medicine Card appears in state and renders on screen; photo upload shows preview; error states render correctly.

---

## Task 10 — Frontend: Section 2 — Check My Precautions

**Wave:** 4  
**Depends on:** Tasks 4, 6  
**Goal:** Build the full Section 2 UI with staleness detection and My Medicine Summary display.

### Sub-tasks

- [ ] 10.1 Create `client/src/components/Section2_CheckPrecautions.jsx`
- [ ] 10.2 Read `medicineCard`, `medicineCardVersion`, `medicineSummaryVersion` from AppContext
- [ ] 10.3 If `medicineCard` is null, render a disabled state with the message: *"Generate a Medicine Card in Section 1 first."*
- [ ] 10.4 Implement `OtherMedicinesInput` (textarea) and `AllergiesInput` (textarea) with accessible labels
- [ ] 10.5 Implement staleness check: `isStale = medicineSummaryVersion !== null && medicineSummaryVersion < medicineCardVersion`
- [ ] 10.6 When `isStale` is true, render `<StaleCardWarning>` and disable the Generate Precautions button
- [ ] 10.7 Create `client/src/components/StaleCardWarning.jsx` — styled warning banner with amber/orange colour
- [ ] 10.8 Implement the "Generate Precautions" button with loading spinner
- [ ] 10.9 On submit, POST to `/api/precautions` with `medicineCard`, `otherMedicines`, `allergies`, `preferredLanguage`
- [ ] 10.10 On success, call `setMedicineSummary(responseText)` and `setMedicineSummaryVersion(medicineCardVersion)`
- [ ] 10.11 Render My Medicine Summary in a styled card below the form
- [ ] 10.12 Display API errors with retry option

**Acceptance criteria:** Section 2 is disabled until Medicine Card exists; staleness warning appears when Medicine Card is regenerated; My Medicine Summary renders correctly.

---

## Task 11 — Frontend: Section 3 — SmartMed Help Chat

**Wave:** 4  
**Depends on:** Tasks 4, 7  
**Goal:** Build the chat interface for SmartMed Help with message history, prompt chips, and emergency notice.

### Sub-tasks

- [ ] 11.1 Create `client/src/components/Section3_AskSmartMed.jsx`
- [ ] 11.2 Create `client/src/components/EmergencyNotice.jsx` — styled red banner, not dismissible
- [ ] 11.3 Render `<EmergencyNotice>` at the top of Section 3 and in the global page header
- [ ] 11.4 Render `chatHistory` from AppContext as a scrollable list; auto-scroll to the latest message after each new entry
- [ ] 11.5 Style message bubbles: user messages right-aligned with `brand-blue` background, assistant messages left-aligned with white background and border
- [ ] 11.6 Render the initial greeting message with the suggestion chips below it:
  - 💬 Explain this instruction simply
  - ⏰ What if I miss a dose?
  - 📋 Prepare my pharmacist summary
  - 🧠 Quiz me on my medicine
- [ ] 11.7 Clicking a prompt chip populates the chat input with that text (but does not auto-submit)
- [ ] 11.8 Implement `ChatInput`: textarea or text input + Send button; submit on Enter key (Shift+Enter for newline)
- [ ] 11.9 On submit, append user message to `chatHistory`, clear the input, show `TypingIndicator`
- [ ] 11.10 POST to `/api/chat` with `message`, `history`, `medicineCard`, `medicineSummary`, `preferredLanguage`
- [ ] 11.11 On response, append assistant reply to `chatHistory` and remove `TypingIndicator`
- [ ] 11.12 Handle API errors: show an error message as an assistant turn in the chat (e.g. *"Sorry, I couldn't reach the server. Please try again."*)
- [ ] 11.13 Ensure the Send button and input are accessible and keyboard-operable
- [ ] 11.14 Create `client/src/components/TypingIndicator.jsx` — animated three-dot indicator

**Acceptance criteria:** Full chat flow works; typing indicator shows while waiting; prompt chips prefill input; emergency notice is always visible; chat history accumulates correctly.

---

## Task 12 — Frontend: Section 4 — Return Unused Medicines

**Wave:** 4  
**Depends on:** Tasks 4, 8  
**Goal:** Build the full Section 4 UI with location input, photo upload, and My Return Plan display.

### Sub-tasks

- [ ] 12.1 Create `client/src/components/Section4_ReturnMedicines.jsx`
- [ ] 12.2 Implement `LocationInput` (text input) and `ReturnItemDetails` (textarea) with accessible labels
- [ ] 12.3 Implement `ReturnPhotoUpload` — same Base64 encoding and validation logic as Section 1 photo upload (consider extracting a shared `useImageUpload` custom hook)
- [ ] 12.4 Always render the myMediSAFE link: `<a href="https://www.mymedicare.gov.my/" target="_blank" rel="noopener noreferrer">Official return directory: myMediSAFE</a>`
- [ ] 12.5 Always render the stop-taking warning below the form
- [ ] 12.6 Implement "Generate Return Plan" button with loading spinner
- [ ] 12.7 On submit, validate `location` and `returnDetails` are non-empty; show inline validation if not
- [ ] 12.8 POST to `/api/return-plan` with `location`, `returnDetails`, `imageBase64`, `imageMimeType`, `preferredLanguage`
- [ ] 12.9 On success, render `MyReturnPlan` in a styled card
- [ ] 12.10 Display API errors with retry option

**Acceptance criteria:** Return plan generates correctly; myMediSAFE link and stop-taking warning are always visible; photo upload works; form validation prevents empty submissions.

---

## Task 13 — Cross-Section Wiring and Staleness Logic

**Wave:** 5  
**Depends on:** Tasks 9, 10, 11, 12  
**Goal:** Verify all cross-section state flows work correctly and the staleness detection is reliable.

### Sub-tasks

- [ ] 13.1 Manually test the full user journey: Section 1 → 2 → 3 → 4
- [ ] 13.2 Verify that regenerating Section 1 (Medicine Card) increments `medicineCardVersion` and triggers the staleness warning in Section 2
- [ ] 13.3 Verify that after regenerating Section 2 (My Medicine Summary), the staleness warning disappears and Section 3 chat uses the updated summary in its system prompt
- [ ] 13.4 Verify that `preferredLanguage` propagates to all API calls and that AI responses come back in the selected language
- [ ] 13.5 Verify Section 4 operates independently — no Medicine Card needed; language still applied from AppContext
- [ ] 13.6 Test the page with an empty session (no Medicine Card, no summary): Section 2 shows the disabled state, Section 3 chat still works with "Not provided" context

**Acceptance criteria:** All cross-section data flows are confirmed working; no stale state is ever silently passed to API calls.

---

## Task 14 — Accessibility Audit and Fixes

**Wave:** 5  
**Depends on:** Tasks 9–12  
**Goal:** Ensure the application meets WCAG 2.1 AA and the accessibility requirements in REQ-06.

### Sub-tasks

- [ ] 14.1 Run `axe` or `eslint-plugin-jsx-a11y` across all components and fix reported violations
- [ ] 14.2 Audit all form inputs for associated `<label>` elements — add any missing labels
- [ ] 14.3 Verify all buttons have descriptive text (not just icons); add `aria-label` where needed
- [ ] 14.4 Confirm all error messages are wrapped in `aria-live="polite"` regions
- [ ] 14.5 Confirm the EmergencyNotice uses `role="alert"` and `aria-live="assertive"` so screen readers announce it immediately
- [ ] 14.6 Test full keyboard navigation through each section (Tab, Shift+Tab, Enter, Space)
- [ ] 14.7 Check colour contrast for all text/background pairs against WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text and UI controls) using a contrast checker
- [ ] 14.8 Verify file upload touch targets meet the 44×44 px minimum
- [ ] 14.9 Verify the chat input can be submitted with Enter and the Send button is focusable

**Acceptance criteria:** Zero critical axe violations; all inputs labelled; keyboard navigation works throughout; Emergency Notice is announced by screen readers.

---

## Task 15 — Responsive Layout Polish

**Wave:** 5  
**Depends on:** Tasks 9–12  
**Goal:** Ensure the application is fully usable on mobile, tablet, and desktop.

### Sub-tasks

- [ ] 15.1 Test all four sections at 320px, 768px, and 1024px+ widths in browser DevTools
- [ ] 15.2 Ensure textareas and inputs use `w-full` and respond to container width
- [ ] 15.3 Ensure the chat message list does not overflow horizontally on small screens
- [ ] 15.4 Verify Medicine Card, My Medicine Summary, and My Return Plan output cards wrap text correctly at all widths
- [ ] 15.5 Verify the EmergencyNotice remains readable and non-hidden at all widths
- [ ] 15.6 Verify photo upload preview thumbnails scale correctly (use `max-w-full h-auto`)
- [ ] 15.7 Ensure the header and section titles use responsive font sizes (`text-lg md:text-2xl` pattern)
- [ ] 15.8 Verify prompt chips in Section 3 wrap gracefully on narrow screens (use `flex-wrap`)

**Acceptance criteria:** App is fully usable and visually clean at 320px, 768px, and 1200px; no horizontal scrollbars.

---

## Task 16 — End-to-End Testing and Final Validation

**Wave:** 6  
**Depends on:** Tasks 13–15  
**Goal:** Run a complete acceptance test covering all requirements.

### Sub-tasks

- [ ] 16.1 Test REQ-01: Submit text-only, image-only, and combined inputs in Section 1; verify Medicine Card renders in all three cases and flags conflicts when both provided
- [ ] 16.2 Test REQ-02: Verify Section 2 is locked before Section 1 completes; verify staleness warning appears after Section 1 regeneration
- [ ] 16.3 Test REQ-03: Verify chat greeting, prompt chips, QUIZ MODE, PHARMACIST SUMMARY block, and emergency escalation (simulate "chest pain" message)
- [ ] 16.4 Test REQ-04: Verify My Return Plan generates; verify myMediSAFE link appears; verify stop-taking warning is visible
- [ ] 16.5 Test REQ-07 (security): Open browser DevTools → Network tab; confirm no AWS credentials appear in any request or response
- [ ] 16.6 Test REQ-08 (error handling): Kill the backend; confirm frontend shows "Could not reach the server" message; restart backend and confirm recovery
- [ ] 16.7 Test multilingual output: change Preferred Language to each of the four options and verify AI outputs language changes accordingly
- [ ] 16.8 Test REQ-09 (performance): Confirm Medicine Card generation begins displaying within 10 seconds on a standard connection
- [ ] 16.9 Verify `.env` is in `.gitignore` and not committed: run `git status` to confirm
- [ ] 16.10 Write a brief `README.md` in the project root documenting: setup steps, environment variable names, how to run client and server in development

**Acceptance criteria:** All listed requirements from requirements.md are demonstrably satisfied; no AWS credentials leak to browser; README is complete.

---

## Task 17* — Streaming Responses (Optional Enhancement)

**Wave:** 6  
**Depends on:** Task 16  
**Effort:** Medium  
**Goal:** Replace full-response API calls with Server-Sent Events streaming so users see AI output token-by-token.

### Sub-tasks

- [ ] 17.1 Update `server/bedrock.js` to use `InvokeModelWithResponseStreamCommand` instead of `InvokeModelCommand`
- [ ] 17.2 Update `/api/chat` (and optionally `/api/medicine-card`, `/api/precautions`, `/api/return-plan`) to stream SSE chunks: set `Content-Type: text/event-stream`, write partial text as `data: {...}\n\n` events
- [ ] 17.3 Update frontend `Section3_AskSmartMed.jsx` to use `EventSource` or `fetch` with `ReadableStream` to consume SSE
- [ ] 17.4 Update the last assistant message in `chatHistory` incrementally as chunks arrive
- [ ] 17.5 Update Medicine Card, My Medicine Summary, and My Return Plan output components to append streamed text progressively
- [ ] 17.6 Ensure the TypingIndicator is replaced by the streaming text as soon as the first token arrives

**Acceptance criteria:** AI responses stream visibly in the UI; no regression in non-streaming functionality; fallback gracefully if streaming is not supported.

---

## Summary Table

| Task | Wave | Depends On | Optional |
|---|---|---|---|
| 1 — Project scaffolding | 1 | — | No |
| 2 — Backend skeleton | 1 | — | No |
| 3 — Bedrock integration + helpers | 2 | 2 | No |
| 4 — AppContext + global state | 2 | 1 | No |
| 5 — /api/medicine-card | 3 | 3 | No |
| 6 — /api/precautions | 3 | 3 | No |
| 7 — /api/chat | 3 | 3 | No |
| 8 — /api/return-plan | 3 | 3 | No |
| 9 — Section 1 frontend | 4 | 4, 5 | No |
| 10 — Section 2 frontend | 4 | 4, 6 | No |
| 11 — Section 3 frontend | 4 | 4, 7 | No |
| 12 — Section 4 frontend | 4 | 4, 8 | No |
| 13 — Cross-section wiring | 5 | 9–12 | No |
| 14 — Accessibility audit | 5 | 9–12 | No |
| 15 — Responsive polish | 5 | 9–12 | No |
| 16 — End-to-end testing | 6 | 13–15 | No |
| 17* — Streaming responses | 6 | 16 | **Yes** |
