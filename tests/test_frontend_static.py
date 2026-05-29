from __future__ import annotations

from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


class FrontendStaticTests(unittest.TestCase):
    def read_static(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_session_labels_prefer_display_number(self):
        source = self.read_static("static/js/format.js")
        self.assertIn("session.display_no ?? session.session_no", source)

    def test_previous_values_are_not_rendered_as_actual_input_values(self):
        source = self.read_static("static/js/render.js")
        self.assertNotIn('setValue(setData, "reps", previous.reps)', source)
        self.assertNotIn('setValue(setData, "weight", previous.weight)', source)
        self.assertNotIn("function setValue", source)
        self.assertRegex(source, r"actualSetValue\(setData,\s*\"weight\"\)")
        self.assertRegex(source, r"actualSetValue\(setData,\s*\"reps\"\)")
        self.assertIn("placeholderForPrevious(previous", source)

    def test_current_session_previous_set_is_not_used_as_placeholder(self):
        source = self.read_static("static/js/render.js")
        match = re.search(r"function previousSetSuggestion\(exerciseId, setIndex\) \{(?P<body>[\s\S]*?)\n\}\n\nfunction bestRepeatSuggestion", source)
        self.assertIsNotNone(match)
        self.assertNotIn("previousInSession", match.group("body"))
        self.assertIn("suggestionForSet", match.group("body"))

    def test_session_suggestions_api_client_and_actions_exist(self):
        api_source = self.read_static("static/js/api.js")
        render_source = self.read_static("static/js/render.js")
        main_source = self.read_static("static/js/main.js")
        html = self.read_static("static/index.html")
        self.assertIn("fetchSessionSuggestions", api_source)
        self.assertIn("/api/session-suggestions", api_source)
        self.assertIn("bestRepeatSuggestion", render_source)
        self.assertIn("fillExerciseEmptySets", render_source)
        self.assertIn("fillWorkoutEmptySets", render_source)
        self.assertIn("Повторить", render_source)
        self.assertIn("Заполнить пустые", html)
        self.assertIn("Заполнить тренировку", html)
        self.assertIn("Заполнить пустые подходы по прошлой тренировке", main_source)

    def test_field_save_does_not_force_full_page_rerender(self):
        source = self.read_static("static/js/main.js")
        match = re.search(r"async function saveSetDraft\(exercise, setIndex, values, focusField = null\) \{(?P<body>[\s\S]*?)\n\}\n\nasync function recordSet", source)
        self.assertIsNotNone(match)
        self.assertIn("renderMetrics();", match.group("body"))
        self.assertIn("queueHistoryRefresh(false);", match.group("body"))
        self.assertNotIn("renderAll(actions)", match.group("body"))

    def test_set_row_uses_explicit_record_and_uncomplete_states(self):
        source = self.read_static("static/js/render.js")
        self.assertIn("Записать", source)
        self.assertIn("✓ Выполнен", source)
        self.assertIn("Отменить", source)
        self.assertNotIn("done-set", source)
        self.assertNotIn('const nextCompleted = row.dataset.completed !== "true"', source)
        self.assertIn("actions.recordSet", source)
        self.assertIn("actions.uncompleteSet", source)

    def test_completed_editing_does_not_start_timer(self):
        source = self.read_static("static/js/main.js")
        draft_match = re.search(r"async function saveSetDraft\(exercise, setIndex, values, focusField = null\) \{(?P<body>[\s\S]*?)\n\}\n\nasync function recordSet", source)
        self.assertIsNotNone(draft_match)
        self.assertNotIn("startRest", draft_match.group("body"))
        self.assertIn("const completed = Boolean(existingSet?.completed)", draft_match.group("body"))
        self.assertIn("async function recordSet", source)
        self.assertIn("async function uncompleteSet", source)

    def test_record_set_starts_timer_only_on_completion_transition(self):
        source = self.read_static("static/js/main.js")
        record_match = re.search(r"async function recordSet\(exercise, setIndex, values\) \{(?P<body>[\s\S]*?)\n\}\n\nasync function uncompleteSet", source)
        self.assertIsNotNone(record_match)
        body = record_match.group("body")
        self.assertIn("const wasCompleted", body)
        self.assertIn("const isCompleted", body)
        self.assertIn("wasCompleted === false && isCompleted === true", body)
        self.assertIn("startRest({", body)

    def test_timer_has_normalized_running_state(self):
        source = self.read_static("static/js/timer.js")
        self.assertIn("export function normalizeRestSeconds", source)
        self.assertIn("export function remainingSeconds", source)
        self.assertRegex(source, r"export function startRest[\s\S]*clearInterval\(interval\)[\s\S]*setInterval\(tick,\s*250\)")

    def test_timer_uses_context_payload_and_next_action(self):
        source = self.read_static("static/js/timer.js")
        self.assertIn("export function startRest(context)", source)
        self.assertNotIn("export function startRest(seconds, exerciseName)", source)
        self.assertIn("setIndex", source)
        self.assertIn("nextSetIndex", source)
        self.assertIn('window.dispatchEvent(new CustomEvent("fitness-tracker:next-set"', source)
        self.assertIn("К подходу", self.read_static("static/index.html"))

    def test_timer_has_floating_mini_state_and_scroll_handler(self):
        timer_source = self.read_static("static/js/timer.js")
        css = self.read_static("static/styles.css")
        self.assertIn("is-floating", timer_source)
        self.assertIn("is-mini-timer", timer_source)
        self.assertIn('window.addEventListener("scroll"', timer_source)
        self.assertIn("updateFloatingTimer", timer_source)
        self.assertIn("is-floating", css)
        self.assertIn("К подходу", timer_source)

    def test_timer_render_does_not_reset_idle_state(self):
        source = self.read_static("static/js/timer.js")
        match = re.search(r"function renderTimer\(\) \{(?P<body>[\s\S]*?)\n\}", source)
        self.assertIsNotNone(match)
        self.assertNotIn("renderIdle()", match.group("body"))

    def test_main_ui_keeps_storage_controls_out_of_workout_flow(self):
        source = self.read_static("static/index.html")
        command_bar = re.search(r"<header class=\"command-bar\">(?P<body>[\s\S]*?)</header>", source)
        self.assertIsNotNone(command_bar)
        self.assertNotIn("Backup", command_bar.group("body"))
        self.assertNotIn("SQLite snapshot", source)

    def test_styles_define_control_tokens_and_exercise_action_polish(self):
        source = self.read_static("static/styles.css")
        self.assertIn("--control-h", source)
        self.assertIn("--control-radius", source)
        self.assertIn("--space-", source)
        self.assertRegex(source, r"\.exercise-actions\s*\{[\s\S]*grid-template-columns")
        self.assertRegex(source, r"\.add-set,\s*\n\.fill-empty\s*\{[\s\S]*height:\s*var\(--control-h\)")

    def test_workout_tabs_keep_letter_inside_card(self):
        source = self.read_static("static/styles.css")
        tab_match = re.search(r"\.workout-tab\s*\{(?P<body>[\s\S]*?)\n\}", source)
        letter_match = re.search(r"\.workout-letter\s*\{(?P<body>[\s\S]*?)\n\}", source)
        self.assertIsNotNone(tab_match)
        self.assertIsNotNone(letter_match)
        tab_body = tab_match.group("body")
        letter_body = letter_match.group("body")
        self.assertIn("display: grid", tab_body)
        self.assertIn("grid-template-columns", tab_body)
        self.assertIn("overflow: hidden", tab_body)
        self.assertIn("display: grid", letter_body)
        self.assertIn("place-items: center", letter_body)
        self.assertNotIn("position: absolute", letter_body)
        self.assertRegex(source, r"\.workout-tab\s*>\s*div:not\(\.workout-letter\)\s*\{[\s\S]*min-width:\s*0")
        pseudo_blocks = re.findall(r"\.workout-tab::(?:before|after)\s*\{(?P<body>[\s\S]*?)\n\}", source)
        for body in pseudo_blocks:
            self.assertNotIn("content: attr", body)

    def test_workout_tabs_use_titles_and_wrap_focus_text(self):
        render_source = self.read_static("static/js/render.js")
        css = self.read_static("static/styles.css")
        self.assertIn("button.title", render_source)
        self.assertIn("title.title", render_source)
        self.assertIn("-webkit-line-clamp: 2", css)
        focus_match = re.search(r"\.workout-tab span\s*\{(?P<body>[\s\S]*?)\n\}", css)
        self.assertIsNotNone(focus_match)
        self.assertIn("white-space: normal", focus_match.group("body"))
        self.assertNotIn("white-space: nowrap", focus_match.group("body"))

    def test_card_accent_has_root_fallback_without_nested_var_warning(self):
        source = self.read_static("static/styles.css")
        self.assertIn("--card-accent: var(--accent);", source)
        self.assertNotIn("var(--card-accent, var(--accent))", source)
        self.assertIn("background-color: var(--card-accent);", source)


if __name__ == "__main__":
    unittest.main()
