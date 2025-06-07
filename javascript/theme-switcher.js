(function () {
  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    return parts.length === 2 ? parts.pop().split(";").shift() : null;
  }

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = name + "=" + value + "; expires=" + expires + "; path=/";
  }

  if (!getCookie("theme")) {
    setCookie("theme", "light", 999999);
  }

  function applySavedTheme() {
    const savedTheme = getCookie("theme") || "light";
    const body = document.body;
    const metaThemeColor = document.getElementById("meta-theme-color");
    const dropdown = document.getElementById("theme-dropdown");

    body.classList.remove("light-theme", "dark-theme");
    body.classList.add(savedTheme + "-theme");

    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", savedTheme === "dark" ? "#141414" : "#EBEBEB");
    }

    if (dropdown) dropdown.value = savedTheme;
  }

  applySavedTheme();

  const themeDropdown = document.getElementById("theme-dropdown");
  if (themeDropdown) {
    themeDropdown.addEventListener("change", function (e) {
      const selectedTheme = e.target.value;
      const body = document.body;
      const metaThemeColor = document.getElementById("meta-theme-color");

      body.classList.remove("light-theme", "dark-theme");
      body.classList.add(selectedTheme + "-theme");

      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", selectedTheme === "dark" ? "#141414" : "#EBEBEB");
      }

      setCookie("theme", selectedTheme, 999999);
    });
  }
})();
