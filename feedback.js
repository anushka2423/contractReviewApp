// Feedback form: validation, states, and saving to Supabase (see supabase.js).
// Kept separate from app.js so the chat and webhook code stay independent.
(function () {
  var MAX_COMMENT = 1000;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var $ = function (id) { return document.getElementById(id); };
  var dialog = $("feedback-dialog");
  var openBtn = $("feedback-btn");
  var closeBtn = $("feedback-close");
  var cancelBtn = $("feedback-cancel");
  var doneBtn = $("feedback-done");
  var form = $("feedback-form");
  var fields = $("feedback-fields");
  var banner = $("feedback-error");
  var success = $("feedback-success");
  var submitBtn = $("feedback-submit");
  var submitLabel = $("feedback-submit-label");
  var spinner = submitBtn.querySelector(".spinner");
  var comment = $("fb-comment");
  var count = $("fb-count");
  var name = $("fb-name");
  var email = $("fb-email");
  var ratingBox = form.querySelector(".rating");

  var submitting = false;

  // Last line of defence: re-check the values right before they leave the browser.
  // (The database enforces the same limits, so bad data is rejected there too.)
  function isValid(p) {
    return Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 5 &&
      p.feedback.length >= 1 && p.feedback.length <= MAX_COMMENT &&
      (p.name === null || p.name.length <= 100) &&
      (p.email === null || (p.email.length <= 254 && EMAIL_RE.test(p.email)));
  }

  // Save to the Supabase `feedback` table. Rejects with a short, user-safe message;
  // the technical detail goes to the console only.
  function submitFeedback(payload) {
    if (!isValid(payload)) {
      return Promise.reject(new Error("Some of the details aren’t valid."));
    }
    if (!window.AppSupabase) {
      return Promise.reject(new Error("Saving isn’t available right now."));
    }
    return window.AppSupabase.insert("feedback", payload).catch(function (err) {
      console.error("[feedback] insert failed:", err);
      throw new Error("Something went wrong on our side.");
    });
  }

  /* ---------- Open / close ---------- */

  function open() {
    if (!dialog.open) dialog.showModal();
  }

  function close() {
    if (submitting) return;
    dialog.close();
  }

  openBtn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  doneBtn.addEventListener("click", close);

  // Esc: don't dismiss while a submission is in flight.
  dialog.addEventListener("cancel", function (e) {
    if (submitting) e.preventDefault();
  });

  // Click on the backdrop (the dialog element itself) closes it.
  dialog.addEventListener("mousedown", function (e) {
    if (e.target === dialog) close();
  });

  // After a successful submission, start fresh next time.
  dialog.addEventListener("close", function () {
    if (!success.hidden) resetAll();
  });

  /* ---------- Validation ---------- */

  function setError(input, errId, message) {
    var el = $(errId);
    el.textContent = message || "";
    el.hidden = !message;
    if (input === ratingBox) {
      ratingBox.classList.toggle("invalid", !!message);
    } else if (message) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  function selectedRating() {
    var checked = form.querySelector('input[name="rating"]:checked');
    return checked ? Number(checked.value) : 0;
  }

  // Returns the first invalid control (or null) and shows every error.
  function validate() {
    var first = null;

    if (!selectedRating()) {
      setError(ratingBox, "err-rating", "Please choose a rating from 1 to 5.");
      first = first || form.querySelector('input[name="rating"]');
    } else {
      setError(ratingBox, "err-rating", "");
    }

    if (!comment.value.trim()) {
      setError(comment, "err-comment", "Please tell us a little about your experience.");
      first = first || comment;
    } else {
      setError(comment, "err-comment", "");
    }

    var mail = email.value.trim();
    if (mail && !EMAIL_RE.test(mail)) {
      setError(email, "err-email", "Enter a valid email address, or leave it blank.");
      first = first || email;
    } else {
      setError(email, "err-email", "");
    }

    return first;
  }

  // Clear an error as soon as the user fixes the field.
  form.addEventListener("change", function (e) {
    if (e.target.name === "rating") setError(ratingBox, "err-rating", "");
  });
  comment.addEventListener("input", function () {
    count.textContent = comment.value.length + " / " + MAX_COMMENT;
    if (comment.value.trim()) setError(comment, "err-comment", "");
  });
  email.addEventListener("input", function () {
    if (!email.value.trim() || EMAIL_RE.test(email.value.trim())) setError(email, "err-email", "");
  });

  /* ---------- Submit ---------- */

  function setSubmitting(on) {
    submitting = on;
    fields.disabled = on;
    form.setAttribute("aria-busy", on ? "true" : "false");
    submitBtn.setAttribute("aria-disabled", on ? "true" : "false");
    cancelBtn.disabled = on;
    closeBtn.disabled = on;
    spinner.hidden = !on;
    submitLabel.textContent = on ? "Submitting…" : "Submit feedback";
  }

  function showBanner(message) {
    banner.textContent = message
      ? "We couldn’t submit your feedback. " + message + " Please try again."
      : "";
    banner.hidden = !message;
  }

  function showSuccess() {
    form.hidden = true;
    success.hidden = false;
    success.focus();
  }

  function resetAll() {
    form.reset();
    count.textContent = "0 / " + MAX_COMMENT;
    setError(ratingBox, "err-rating", "");
    setError(comment, "err-comment", "");
    setError(email, "err-email", "");
    setError(name, "err-name", "");
    showBanner("");
    success.hidden = true;
    form.hidden = false;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return; // ignore duplicate submissions

    showBanner("");
    var invalid = validate();
    if (invalid) {
      invalid.focus();
      return;
    }

    var payload = {
      rating: selectedRating(),
      feedback: comment.value.trim(),   // column names match the `feedback` table
      name: name.value.trim() || null,
      email: email.value.trim() || null
    };

    setSubmitting(true);
    submitFeedback(payload)
      .then(function () {
        setSubmitting(false);
        showSuccess();
      })
      .catch(function (err) {
        setSubmitting(false);
        showBanner(err && err.message ? err.message : "");
        if (!banner.textContent) showBanner("Something went wrong.");
        submitBtn.focus();
      });
  });
})();
