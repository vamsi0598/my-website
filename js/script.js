/* =============================================
   CUSTOM JAVASCRIPT FOR MyBiz
============================================= */

document.addEventListener("DOMContentLoaded", () => {
    console.log("MyBiz Loaded");

    setActiveNav();
    initFadeAnimations();
    initScrollToTopButton();
});

/* ---------------------------------------------
   Active Navigation Highlight
---------------------------------------------- */
function setActiveNav() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".navbar-nav .nav-link").forEach(link => {
        link.classList.toggle("active", link.getAttribute("href") === currentPage);
    });
}

/* ---------------------------------------------
   Fade-in on Scroll (with delay fix)
---------------------------------------------- */
function initFadeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("fade-in");
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Delay ensures Live Server detects first render
    setTimeout(() => {
        document.querySelectorAll(".fade-in-on-scroll").forEach(el => observer.observe(el));
    }, 100);
}

/* ---------------------------------------------
   Scroll To Top Button
---------------------------------------------- */
function initScrollToTopButton() {
    const btn = document.createElement("button");
    btn.innerText = "↑";
    btn.id = "scrollTopBtn";

    Object.assign(btn.style, {
        position: "fixed",
        bottom: "25px",
        right: "25px",
        padding: "10px 14px",
        fontSize: "18px",
        borderRadius: "50%",
        border: "none",
        background: "#0d6efd",
        color: "white",
        cursor: "pointer",
        display: "none",
        zIndex: 9999,
    });

    document.body.appendChild(btn);

    window.addEventListener("scroll", () => {
        btn.style.display = window.scrollY > 400 ? "block" : "none";
    });

    btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}
