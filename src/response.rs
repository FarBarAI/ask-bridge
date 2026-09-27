use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Message {
    pub key: String,
    pub signature: String,
    pub has_content: bool,
    pub after_user: bool,
    pub streaming: bool,
    pub complete_signal: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Snapshot {
    pub url: String,
    pub page_key: String,
    pub user_key: String,
    pub generating: bool,
    pub messages: Vec<Message>,
}

impl Snapshot {
    pub fn latest(&self) -> Option<&Message> {
        self.messages.last().filter(|message| message.after_user)
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct Target {
    pub url: String,
    pub key: String,
    pub signature: String,
}

pub struct Tracker {
    baseline: Option<Snapshot>,
    previous: Option<(String, String, Duration)>,
}

impl Tracker {
    pub fn new(baseline: Option<Snapshot>) -> Self {
        Self {
            baseline,
            previous: None,
        }
    }

    pub fn accepts(&self, snapshot: &Snapshot) -> bool {
        let Some(message) = snapshot.latest() else {
            return false;
        };
        let Some(baseline) = &self.baseline else {
            return true;
        };
        if snapshot.page_key != baseline.page_key {
            return false;
        }
        let old: HashMap<_, _> = baseline
            .messages
            .iter()
            .map(|message| (&message.key, &message.signature))
            .collect();
        let changed = old
            .get(&message.key)
            .is_none_or(|signature| **signature != message.signature);
        let user_changed = if snapshot.user_key.is_empty() {
            // 未提供使用者訊息標記的舊介面，僅接受新的回答識別碼。
            baseline.user_key.is_empty()
                && !old.contains_key(&message.key)
                && !baseline
                    .messages
                    .iter()
                    .any(|old| old.signature == message.signature)
        } else {
            snapshot.user_key != baseline.user_key
        };
        changed && user_changed
    }

    pub fn reset_stability(&mut self) {
        self.previous = None;
    }

    pub fn observe(&mut self, snapshot: &Snapshot, elapsed: Duration) -> bool {
        let Some(message) = snapshot.latest().filter(|_| self.accepts(snapshot)) else {
            self.reset_stability();
            return false;
        };
        if snapshot.generating
            || message.streaming
            || !message.has_content
            || !message.complete_signal
        {
            self.reset_stability();
            return false;
        }
        match &self.previous {
            Some((key, signature, since))
                if key == &message.key && signature == &message.signature =>
            {
                elapsed.saturating_sub(*since) >= Duration::from_secs(1)
            }
            _ => {
                self.previous = Some((message.key.clone(), message.signature.clone(), elapsed));
                false
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snapshot(key: &str, user: &str) -> Snapshot {
        Snapshot {
            url: "https://chatgpt.com/c/example".into(),
            page_key: "page".into(),
            user_key: user.into(),
            generating: false,
            messages: vec![Message {
                key: key.into(),
                signature: "answer".into(),
                has_content: true,
                after_user: true,
                streaming: false,
                complete_signal: true,
            }],
        }
    }

    #[test]
    fn accepts_new_response_even_when_message_count_does_not_increase() {
        let before = snapshot("old", "old-user");
        let after = snapshot("new", "new-user");
        let mut tracker = Tracker::new(Some(before));
        assert!(!tracker.observe(&after, Duration::ZERO));
        assert!(tracker.observe(&after, Duration::from_secs(1)));
    }

    #[test]
    fn does_not_retrieve_previous_response_for_a_new_prompt() {
        let before = snapshot("old", "old-user");
        let mut after = before.clone();
        after.user_key = "new-user".into();
        let tracker = Tracker::new(Some(before));
        assert!(!tracker.accepts(&after));
        after.messages[0].after_user = false;
        assert!(!tracker.accepts(&after));
    }

    #[test]
    fn paused_text_without_completion_signal_is_not_done() {
        let mut state = snapshot("new", "new-user");
        state.messages[0].complete_signal = false;
        let mut tracker = Tracker::new(None);
        assert!(!tracker.observe(&state, Duration::ZERO));
        assert!(!tracker.observe(&state, Duration::from_secs(300)));
    }

    #[test]
    fn generating_or_changed_text_resets_completion_stability() {
        let mut state = snapshot("new", "new-user");
        let mut tracker = Tracker::new(None);
        assert!(!tracker.observe(&state, Duration::ZERO));
        state.generating = true;
        assert!(!tracker.observe(&state, Duration::from_secs(1)));
        state.generating = false;
        assert!(!tracker.observe(&state, Duration::from_secs(2)));
        state.messages[0].signature = "changed".into();
        assert!(!tracker.observe(&state, Duration::from_secs(3)));
        assert!(tracker.observe(&state, Duration::from_secs(4)));
    }

    #[test]
    fn unchanged_existing_answer_can_be_retrieved_by_get() {
        let state = snapshot("old", "old-user");
        let mut tracker = Tracker::new(None);
        assert!(!tracker.observe(&state, Duration::ZERO));
        assert!(tracker.observe(&state, Duration::from_secs(1)));
    }

    #[test]
    fn rerendered_old_answer_without_user_identity_is_not_a_new_response() {
        let before = snapshot("old-element", "");
        let after = snapshot("rerendered-element", "");
        let tracker = Tracker::new(Some(before));
        assert!(!tracker.accepts(&after));
    }

    #[test]
    fn another_page_cannot_supply_a_new_request_response() {
        let before = snapshot("old", "old-user");
        let mut after = snapshot("new", "new-user");
        after.page_key = "other-page".into();
        let tracker = Tracker::new(Some(before));
        assert!(!tracker.accepts(&after));
    }

    #[test]
    fn streaming_empty_content_and_interrupted_observations_cannot_complete() {
        let mut state = snapshot("answer", "user");
        let mut tracker = Tracker::new(None);
        state.messages[0].streaming = true;
        assert!(!tracker.observe(&state, Duration::ZERO));
        state.messages[0].streaming = false;
        state.messages[0].has_content = false;
        assert!(!tracker.observe(&state, Duration::from_secs(1)));
        state.messages[0].has_content = true;
        assert!(!tracker.observe(&state, Duration::from_secs(2)));
        tracker.reset_stability();
        assert!(!tracker.observe(&state, Duration::from_secs(3)));
        assert!(tracker.observe(&state, Duration::from_secs(4)));
    }
}
