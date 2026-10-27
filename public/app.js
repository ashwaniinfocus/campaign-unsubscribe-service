(function () {
  var form = document.getElementById("unsub-form");
  var toast = document.getElementById("toast");
  if (!form || !toast) return;

  var group = form.querySelector(".reasons");
  var timer;

  function hideToast() {
    clearTimeout(timer);
    toast.classList.remove("show");
    toast.hidden = true;
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    toast.classList.remove("show");
    void toast.offsetWidth; // restart the animation on repeated clicks
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(hideToast, 4500);
  }

  form.addEventListener("submit", function (event) {
    if (form.querySelector('input[name="reason"]:checked')) return;
    event.preventDefault();
    group.classList.add("has-error");
    showToast("Please select a reason to unsubscribe. It's mandatory.");
    var first = form.querySelector('input[name="reason"]');
    if (first) first.focus();
  });

  form.addEventListener("change", function (event) {
    if (event.target && event.target.name === "reason") {
      group.classList.remove("has-error");
      hideToast();
    }
  });

  toast.addEventListener("click", hideToast);
})();
