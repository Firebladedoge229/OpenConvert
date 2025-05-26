document.addEventListener("DOMContentLoaded", () => {
    function setCookie(name, value, days) {
        const expires = new Date(Date.now() + days * 86400000).toUTCString();
        document.cookie = `${name}=${value}; expires=${expires}; path=/`;
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        return parts.length === 2 ? parts.pop().split(";").shift() : null;
    }

    if (!getCookie("theme")) {
        setCookie("theme", "light", 999999); 
    }

    function applySavedTheme() {
        const savedTheme = getCookie("theme") || "light"; 
        document.body.classList.add(`${savedTheme}-theme`);
        const dropdown = document.getElementById("theme-dropdown");
        if (dropdown) dropdown.value = savedTheme;
    }

    applySavedTheme();

    const dropdown = document.getElementById("theme-dropdown");
    if (dropdown) {
        dropdown.addEventListener("change", () => {
            console.log("Theme changed to:", dropdown.value);
            const selectedTheme = dropdown.value;
            setCookie("theme", selectedTheme, 999999); 

            document.body.classList.forEach(cls => {
                if (cls.endsWith("-theme")) {
                    document.body.classList.remove(cls);
                }
            });

            document.body.classList.add(`${selectedTheme}-theme`);
        });
    }
});