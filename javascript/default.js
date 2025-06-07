(function() {
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    return parts.length === 2 ? parts.pop().split(";").shift() : null;
  }
  const savedTheme = getCookie("theme") || "light";
  const metaThemeColor = document.getElementById("meta-theme-color");
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", savedTheme === "dark" ? "#141414" : "#EBEBEB");
  }
})();
