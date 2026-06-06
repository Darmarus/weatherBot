/* =========================================================
   Weather AI Assistant — script.js
   Modularny silnik czatu (Vanilla JS, IIFE + moduły)
   Funkcje: analiza pogody, rekomendacje ubioru, typing,
            LocalStorage, dark mode, Fetch API (OpenWeather)
   ========================================================= */

"use strict";

/* =========================================================
   MODUŁ 1 — WeatherBrain: logika rekomendacji ubioru
   Czysta logika (bez DOM) — łatwa do testowania i rozbudowy.
   ========================================================= */
const WeatherBrain = (() => {

    function parseTemperature(text) {
        // dopasowanie liczby (z opcjonalnym minusem) przy słowach stopni/°/C
        const match = text.match(/(-?\d+)\s*(?:°|stopn|stopni|c\b|℃)/i)
            || text.match(/(-?\d+)\s*(?=°|st)/i)
            || text.match(/(-?\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    function detectConditions(text) {
        const t = text.toLowerCase();
        return {
            rain: /(deszcz|pada|mżaw|ulew|kropi|mokro|przelotn)/.test(t),
            snow: /(śnieg|snieg|śnież|snież|zamieć|zawiej)/.test(t),
            wind: /(wiatr|wietrzn|wieje|porywist|wichur)/.test(t),
            sun: /(słońc|slonc|słonecz|sloneczn|upał|upal|gorąc|gorac|bezchmurn)/.test(t),
            fog: /(mgła|mgla|mglist)/.test(t),
            storm: /(burz|grzmot|piorun)/.test(t),
            cold: /(zimno|mróz|mroz|chłód|chlod|chłodn|chlodn|marzn)/.test(t),
            hot: /(upał|upal|gorąc|gorac|skwar|parno)/.test(t),
        };
    }

    /* Klasyfikacja temperatury → słowny opis + dobór warstw */
    function classifyTemp(temp) {
        if (temp === null) return null;
        if (temp <= -5) return { label: "siarczysty mróz", layers: "kilka ciepłych warstw, gruba puchowa kurtka, czapka, szalik i rękawiczki" };
        if (temp <= 0) return { label: "mróz", layers: "zimowa kurtka, czapka, szalik i rękawiczki" };
        if (temp <= 7) return { label: "zimno", layers: "ciepła kurtka, sweter i długie spodnie" };
        if (temp <= 14) return { label: "chłodno", layers: "kurtka przejściowa lub bluza z długim rękawem" };
        if (temp <= 20) return { label: "umiarkowanie", layers: "lekka bluza lub koszula z długim rękawem" };
        if (temp <= 26) return { label: "ciepło", layers: "t-shirt i lekkie spodnie lub spódnica" };
        return { label: "upalnie", layers: "przewiewne, jasne ubrania, krótki rękaw i szorty" };
    }

    /*
       Główna funkcja: buduje rekomendację na podstawie
       temperatury i warunków. Zwraca sformatowany tekst.
    */
    function recommend(text, knownTemp = null) {
        const temp = knownTemp !== null ? knownTemp : parseTemperature(text);
        const c = detectConditions(text);
        const tempClass = classifyTemp(temp);

        const noData = temp === null &&
            !c.rain && !c.snow && !c.wind && !c.sun && !c.fog && !c.storm && !c.cold && !c.hot;
        if (noData) {
            return "Chętnie doradzę! 🌤️ Napisz, jaka jest temperatura i pogoda — " +
                "np. „Jest 7 stopni i pada deszcz”, a dobiorę dla Ciebie ubiór.";
        }

        const parts = [];

        if (tempClass) {
            parts.push(`Przy ${temp}° (${tempClass.label}) załóż ${tempClass.layers}.`);
        } else if (c.cold) {
            parts.push("Robi się zimno — postaw na ciepłą kurtkę i warstwy.");
        } else if (c.hot) {
            parts.push("Jest gorąco — wybierz przewiewne, jasne ubrania.");
        }

        if (c.rain || c.storm) {
            parts.push("☔ Pada — weź kurtkę przeciwdeszczową lub parasol oraz wodoodporne buty.");
        }

        /* --- 3. Ochrona przed śniegiem --- */
        if (c.snow) {
            parts.push("❄️ Przy śniegu przydadzą się nieprzemakalne, ocieplane buty z dobrą podeszwą.");
        }

        /* --- 4. Wiatr --- */
        if (c.wind) {
            parts.push("💨 Wieje — załóż coś wiatroszczelnego i zapnij się pod szyją.");
        }

        /* --- 5. Słońce / upał --- */
        if (c.sun || c.hot) {
            parts.push("😎 Słonecznie — nie zapomnij o okularach, nakryciu głowy i kremie z filtrem SPF.");
        }

        /* --- 6. Mgła --- */
        if (c.fog) {
            parts.push("🌫️ Mgła ogranicza widoczność — wybierz odzież w jasnych lub odblaskowych kolorach.");
        }

        /* --- 7. Akcent stylu --- */
        parts.push(styleTip(temp, c));

        return parts.join("\n\n");
    }

    /* Krótka porada stylistyczna (dodatkowy charakter bota) */
    function styleTip(temp, c) {
        if (c.rain || c.storm) return "💡 Styl: trencz lub parka w stonowanym kolorze będzie i praktyczny, i elegancki.";
        if (c.snow) return "💡 Styl: gruby golf i kozaki dodadzą zimowej stylizacji charakteru.";
        if (temp !== null && temp >= 27) return "💡 Styl: lniana koszula i sandały sprawdzą się w upalny dzień.";
        if (temp !== null && temp <= 0) return "💡 Styl: czapka beanie i szalik w kontrastowym kolorze ożywią zimowy zestaw.";
        return "💡 Styl: warstwy łatwo dopasujesz do zmiennej pogody — i wyglądają modnie.";
    }

    return { recommend, parseTemperature, detectConditions, classifyTemp };
})();


/* =========================================================
   MODUŁ 2 — WeatherAPI: integracja z OpenWeather (Fetch API)
   Działa po wpisaniu klyucza; w przeciwnym razie zwraca demo.
   ========================================================= */
const WeatherAPI = (() => {
    const BASE = "https://api.openweathermap.org/data/2.5/weather";

    async function fetchByCity(city) {
        if (!API_KEY) {
            return demoData(city);
        }
        const url = `${BASE}?q=${encodeURIComponent(city)}&units=metric&lang=pl&appid=${API_KEY}`;
        const data = await res.json();
        return {
            city: data.name,
            temp: Math.round(data.main.temp),
            description: data.weather?.[0]?.description ?? "",
            demo: false,
        };
    }

        const samples = [
            { temp: 6, description: "lekki deszcz" },
            { temp: -3, description: "opady śniegu" },
            { temp: 24, description: "słonecznie" },
            { temp: 12, description: "pochmurno i wietrznie" },
        ];
        const s = samples[Math.floor(Math.random() * samples.length)];
    }

    return { fetchByCity, hasKey: () => Boolean(API_KEY) };
})();


/* =========================================================
   MODUŁ 3 — ChatUI: warstwa interfejsu i sterowanie aplikacją
   ========================================================= */
const ChatUI = (() => {
    const chatBox = document.getElementById("chat-box");
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const themeToggle = document.getElementById("theme-toggle");
    const clearBtn = document.getElementById("clear-btn");
    const weatherToggle = document.getElementById("weather-toggle");
    const weatherPanel = document.getElementById("weather-panel");
    const weatherForm = document.getElementById("weather-form");
    const cityInput = document.getElementById("city-input");
    const weatherHint = document.getElementById("weather-hint");

    const STORAGE_KEY = "weatherbot.history";
    const THEME_KEY = "weatherbot.theme";

    function now() {
        return new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    }

    /* --- Dodaje wiadomość do DOM (i opcjonalnie zapisuje) --- */
    function addMessage(message, sender, time = now(), persist = true) {
        const div = document.createElement("div");
        div.classList.add("msg", sender);

        const textNode = document.createElement("span");
        textNode.classList.add("msg__text");
        div.appendChild(textNode);

        const timeNode = document.createElement("span");
        timeNode.classList.add("msg__time");
        timeNode.textContent = time;
        div.appendChild(timeNode);

        chatBox.appendChild(div);
        scrollToBottom();

        if (persist) saveMessage(message, sender, time);
    }

    /* --- Wskaźnik „pisze…” --- */
    function showTyping() {
        const wrap = document.createElement("div");
        wrap.classList.add("typing");
        wrap.id = "typing-indicator";
        wrap.setAttribute("aria-label", "Asystent pisze");
        wrap.innerHTML = "<span></span><span></span><span></span>";
        chatBox.appendChild(wrap);
        scrollToBottom();
    }

    function hideTyping() {
        document.getElementById("typing-indicator")?.remove();
    }

    function scrollToBottom() {
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    /* --- Odpowiedź bota z animacją pisania --- */
    function botReply(text, delay = 700) {
        showTyping();
        setTimeout(() => {
            hideTyping();
            addMessage(text, "bot-message");
        }, delay);
    }

    function loadHistory() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveMessage(message, sender, time) {
        const history = loadHistory();
        history.push({ message, sender, time });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }

    function clearHistory() {
        localStorage.removeItem(STORAGE_KEY);
        chatBox.innerHTML = "";
        greet();
    }

    /* --- Powitanie (gdy brak historii) --- */
    function greet() {
        botReply(
            "Cześć! Jestem Twoim asystentem pogodowym. 🌦️\n" +
            400
        );
    }

    /* =========================================================
       Dark mode
       ========================================================= */
    function applyTheme(theme) {
        const dark = theme === "dark";
        document.body.classList.toggle("dark", dark);
        themeToggle.textContent = dark ? "☀️" : "🌙";
        themeToggle.setAttribute("aria-pressed", String(dark));
    }

    function toggleTheme() {
        const dark = !document.body.classList.contains("dark");
        const theme = dark ? "dark" : "light";
        applyTheme(theme);
        localStorage.setItem(THEME_KEY, theme);
    }

    /* =========================================================
       Obsługa wysyłania wiadomości użytkownika
       ========================================================= */
    function handleUserMessage(rawText) {
        const text = rawText.trim();
        if (!text) return;

        addMessage(text, "user-message");
        userInput.value = "";

        // Jeśli wiadomość to sama nazwa miasta (bez temperatury i opisu pogody),
        // pobierz dane z API zamiast prosić o doprecyzowanie.
        if (looksLikeCity(text)) {
            fetchAndRecommend(text);
            return;
        }

        const response = WeatherBrain.recommend(text);
        botReply(response);
    }

    /* --- Heurystyka: czy tekst wygląda jak sama nazwa miasta? --- */
    function looksLikeCity(text) {
        // Zawiera temperaturę → to opis pogody, nie miasto
        if (WeatherBrain.parseTemperature(text) !== null) return false;
        // Wykryto warunki pogodowe → to opis pogody, nie miasto
        const c = WeatherBrain.detectConditions(text);
        if (Object.values(c).some(Boolean)) return false;
        // Tylko litery (w tym polskie), spacje, kropki i myślniki; maks. 3 słowa
        const cleaned = text.trim();
        if (cleaned.split(/\s+/).length > 3) return false;
        return /^[\p{L}][\p{L}\s.-]*$/u.test(cleaned);
    }

    /* =========================================================
       Pobranie pogody z API i rekomendacja
       ========================================================= */
    async function handleCityWeather(city) {
        if (!city.trim()) return;
        addMessage(`Sprawdź pogodę dla: ${city}`, "user-message");
        cityInput.value = "";
        await fetchAndRecommend(city);
    }

    /* --- Wspólna logika: pobierz pogodę dla miasta i doradź ubiór --- */
    async function fetchAndRecommend(city) {
        showTyping();

        try {
            const data = await WeatherAPI.fetchByCity(city);
            hideTyping();

            addMessage(
                `🌍 ${data.city}: ${data.temp}°, ${data.description}${demoNote}`,
                "bot-message"
            );

            // Łączymy temperaturę z API z analizą warunków z opisu
            const recommendation = WeatherBrain.recommend(data.description, data.temp);
            botReply(recommendation, 600);
        } catch (err) {
            hideTyping();
            addMessage(`⚠️ ${err.message}`, "bot-message");
        }
    }

    /* =========================================================
       Inicjalizacja — podpięcie zdarzeń i wczytanie stanu
       ========================================================= */
    function init() {
        const savedTheme = localStorage.getItem(THEME_KEY)
            || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        applyTheme(savedTheme);

        const history = loadHistory();
        if (history.length) {
            history.forEach(m => addMessage(m.message, m.sender, m.time, false));
        } else {
            greet();
        }

        // Formularz czatu
        chatForm.addEventListener("submit", e => {
            e.preventDefault();
            handleUserMessage(userInput.value);
        });

        themeToggle.addEventListener("click", toggleTheme);

        clearBtn.addEventListener("click", () => {
            if (confirm("Wyczyścić całą historię rozmowy?")) clearHistory();
        });

        weatherToggle.addEventListener("click", () => {
            weatherPanel.hidden = !weatherPanel.hidden;
            if (!weatherPanel.hidden) {
                weatherHint.textContent = WeatherAPI.hasKey()
                    ? "Pobiera dane na żywo z OpenWeather."
                    : "Brak klucza API — bot użyje danych demonstracyjnych. Klucz dodasz w pliku script.js.";
                cityInput.focus();
            }
        });

        weatherForm.addEventListener("submit", e => {
            e.preventDefault();
            handleCityWeather(cityInput.value);
        });
    }

    return { init };
})();

document.addEventListener("DOMContentLoaded", ChatUI.init);
