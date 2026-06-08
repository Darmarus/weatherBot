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
    /* Strukturalna analiza pogody — wspólna baza dla trybu standard i smart.
       Zwraca surowe dane (temp, warunki, klasa), z których tryb standard buduje
       poradę, a tryb smart przekazuje je modelowi AI jako „ocenę pogody”. */
    function analyze(text, knownTemp = null) {
        const temp = knownTemp !== null ? knownTemp : parseTemperature(text);
        const conditions = detectConditions(text);
        const tempClass = classifyTemp(temp);
        const hasData = temp !== null || Object.values(conditions).some(Boolean);
        return { temp, conditions, tempClass, hasData };
    }

    function recommend(text, knownTemp = null) {
        const { temp, conditions: c, tempClass, hasData } = analyze(text, knownTemp);

        if (!hasData) {
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

    return { recommend, analyze, parseTemperature, detectConditions, classifyTemp };
})();


/* =========================================================
   MODUŁ 2 — WeatherAPI: integracja z OpenWeather (Fetch API)
   Działa po wpisaniu klyucza; w przeciwnym razie zwraca demo.
   ========================================================= */
const WeatherAPI = (() => {
    // 🔑 Klucz z https://home.openweathermap.org/api_keys
    const API_KEY = "6f7de560e975af0b9acaaf438164af32";
    const BASE = "https://api.openweathermap.org/data/2.5/weather";

    async function fetchByCity(city) {
        if (!API_KEY) {
            // Tryb demonstracyjny bez klucza — losowe, ale realistyczne dane
            return demoData(city);
        }
        const url = `${BASE}?q=${encodeURIComponent(city)}&units=metric&lang=pl&appid=${API_KEY}`;

        let res;
        try {
            res = await fetch(url);
        } catch {
            // Brak sieci / błąd połączenia → łagodny fallback na dane demo
            return demoData(city, "brak połączenia z API");
        }

        if (!res.ok) {
            // 401 = klucz jeszcze nieaktywny lub nieprawidłowy → fallback na demo,
            // żeby czat działał, zanim klucz OpenWeather się aktywuje (~do 2 godz.).
            if (res.status === 401) return demoData(city, "klucz API jeszcze nieaktywny");
            if (res.status === 404) throw new Error(`Nie znaleziono miasta „${city}”.`);
            if (res.status === 429) throw new Error("Przekroczono limit zapytań do API — spróbuj za chwilę.");
            throw new Error(`Błąd pobierania pogody (HTTP ${res.status}).`);
        }

        const data = await res.json();
        return {
            city: data.name,
            temp: Math.round(data.main.temp),
            description: data.weather?.[0]?.description ?? "",
            demo: false,
        };
    }

    function demoData(city, reason = "") {
        const samples = [
            { temp: 6, description: "lekki deszcz" },
            { temp: -3, description: "opady śniegu" },
            { temp: 24, description: "słonecznie" },
            { temp: 12, description: "pochmurno i wietrznie" },
        ];
        const s = samples[Math.floor(Math.random() * samples.length)];
        return { city: city || "Twoje miasto", ...s, demo: true, demoReason: reason };
    }

    return { fetchByCity, hasKey: () => Boolean(API_KEY) };
})();


/* =========================================================
   MODUŁ 3 — Settings: tryb pracy (standard / smart) + konfiguracja
   OpenRouter. Trwałość w LocalStorage. Bez DOM.
   ========================================================= */
const Settings = (() => {
    const KEY = "weatherbot.settings";
    const defaults = { mode: "standard", apiKey: "", model: "" };

    let state = load();

    function load() {
        try {
            return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
        } catch {
            return { ...defaults };
        }
    }

    function persist() {
        localStorage.setItem(KEY, JSON.stringify(state));
    }

    function get() {
        return { ...state };
    }

    function update(patch) {
        state = { ...state, ...patch };
        persist();
        return get();
    }

    /* Tryb smart jest aktywny tylko, gdy wybrano go ORAZ podano klucz i model. */
    function isSmart() {
        return state.mode === "smart" && Boolean(state.apiKey) && Boolean(state.model);
    }

    return { get, update, isSmart };
})();


/* =========================================================
   MODUŁ 4 — SmartAdvisor: rekomendacja generowana przez model AI
   (OpenRouter). Otrzymuje ocenę pogody z WeatherBrain jako materiał
   i wyrażenia, ale treść utrzymuje adekwatną do tej oceny.
   ========================================================= */
const SmartAdvisor = (() => {
    const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

    /* Buduje wiadomości dla modelu: system ustala ton i ograniczenia,
       user przekazuje konkretną ocenę pogody oraz wyrażenia do parafrazy. */
    function buildMessages({ description, assessment, reference }) {
        const { temp, tempClass, conditions } = assessment;

        const condList = Object.entries(conditions)
            .filter(([, on]) => on)
            .map(([name]) => name)
            .join(", ") || "brak szczególnych";

        const tempInfo = temp !== null
            ? `${temp}°C (${tempClass ? tempClass.label : "—"})`
            : "nieznana";
        const layers = tempClass ? tempClass.layers : "—";

        const system = [
            "Jesteś przyjaznym asystentem pogodowym, który doradza, jak się ubrać.",
            "Odpowiadasz po polsku, ciepło i zwięźle (2–4 zdania).",
            "Trzymaj się ściśle przekazanej oceny pogody — nie zmyślaj temperatury ani warunków.",
            "Możesz swobodnie parafrazować podane wyrażenia i dodać 1–2 pasujące emoji.",
        ].join(" ");

        const user = [
            `Pogoda: ${description || "—"}.`,
            `Temperatura: ${tempInfo}.`,
            `Wykryte warunki: ${condList}.`,
            `Sugerowany ubiór (ocena): ${layers}.`,
            "",
            "Wyrażenia, których możesz użyć (parafrazuj, nie kopiuj dosłownie):",
            reference,
            "",
            "Napisz na tej podstawie naturalną rekomendację ubioru, adekwatną do powyższej oceny pogody.",
        ].join("\n");

        return [
            { role: "system", content: system },
            { role: "user", content: user },
        ];
    }

    async function advise(payload, settings) {
        const { apiKey, model } = settings;
        if (!apiKey) throw new Error("brak klucza OpenRouter");
        if (!model) throw new Error("brak nazwy modelu");

        let res;
        try {
            res = await fetch(ENDPOINT, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": location.origin,
                    "X-Title": "Weather Assistant",
                },
                body: JSON.stringify({
                    model,
                    messages: buildMessages(payload),
                    temperature: 0.7,
                    max_tokens: 300,
                }),
            });
        } catch {
            throw new Error("brak połączenia z OpenRouter");
        }

        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const err = await res.json();
                detail = err?.error?.message || detail;
            } catch { /* odpowiedź bez JSON-a — zostaje kod HTTP */ }
            throw new Error(detail);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error("pusta odpowiedź modelu");
        return content;
    }

    return { advise };
})();


/* =========================================================
   MODUŁ 5 — ChatUI: warstwa interfejsu i sterowanie aplikacją
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
    const settingsToggle = document.getElementById("settings-toggle");
    const settingsPanel = document.getElementById("settings-panel");
    const smartFields = document.getElementById("smart-fields");
    const keyInput = document.getElementById("openrouter-key");
    const modelInput = document.getElementById("openrouter-model");
    const settingsHint = document.getElementById("settings-hint");
    const modeRadios = () => document.querySelectorAll('input[name="mode"]');

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
        textNode.textContent = message; // textContent = bezpieczne (brak XSS)
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
            "Opisz pogodę (np. „Jest 7 stopni i pada deszcz”) lub wpisz samą nazwę " +
            "miasta (np. „Warszawa”), a doradzę Ci, jak się ubrać. Możesz też kliknąć 📍.",
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

        respondWithRecommendation(text);
    }

    /* =========================================================
       Rekomendacja: tryb standardowy (WeatherBrain) lub smart (OpenRouter).
       W trybie smart ocena z WeatherBrain trafia do modelu jako materiał;
       przy braku danych pogodowych albo błędzie — fallback na tryb standard.
       ========================================================= */
    async function respondWithRecommendation(text, knownTemp = null) {
        const assessment = WeatherBrain.analyze(text, knownTemp);
        const fallback = WeatherBrain.recommend(text, knownTemp);

        // Bez danych pogodowych nie ma czego analizować — klasyczna podpowiedź.
        if (!assessment.hasData || !Settings.isSmart()) {
            botReply(fallback);
            return;
        }

        showTyping();
        try {
            const reply = await SmartAdvisor.advise(
                { description: text, assessment, reference: fallback },
                Settings.get()
            );
            hideTyping();
            addMessage(reply, "bot-message");
        } catch (err) {
            hideTyping();
            addMessage(
                `${fallback}\n\n⚠️ Tryb smart niedostępny (${err.message}) — użyłem trybu standardowego.`,
                "bot-message"
            );
        }
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

            const demoNote = data.demo
                ? ` (dane demonstracyjne${data.demoReason ? " — " + data.demoReason : " — dodaj klucz API"})`
                : "";
            addMessage(
                `🌍 ${data.city}: ${data.temp}°, ${data.description}${demoNote}`,
                "bot-message"
            );

            // Łączymy temperaturę z API z analizą warunków z opisu
            await respondWithRecommendation(data.description, data.temp);
        } catch (err) {
            hideTyping();
            addMessage(`⚠️ ${err.message}`, "bot-message");
        }
    }

    /* =========================================================
       Panel ustawień (tryb standard / smart + dane OpenRouter)
       ========================================================= */

    /* Komunikat pomocniczy zależny od stanu — model pokazujemy, klucz NIGDY. */
    function settingsStatus() {
        const s = Settings.get();
        if (s.mode === "standard") {
            return "Tryb standardowy — wbudowana logika, bez klucza.";
        }
        if (!s.apiKey || !s.model) {
            return "Uzupełnij klucz OpenRouter i nazwę modelu, aby włączyć tryb smart.";
        }
        return `Tryb smart gotowy ✓ — odpowiedzi pisze model „${s.model}”.`;
    }

    /* Synchronizuje kontrolki z zapisanym stanem i pokazuje/chowa pola smart. */
    function syncSettingsUI() {
        const s = Settings.get();
        modeRadios().forEach(r => { r.checked = r.value === s.mode; });
        keyInput.value = s.apiKey;
        modelInput.value = s.model;
        smartFields.hidden = s.mode !== "smart";
        settingsHint.textContent = settingsStatus();
    }

    function bindSettings() {
        settingsToggle.addEventListener("click", () => {
            const open = settingsPanel.hidden;
            settingsPanel.hidden = !open;
            settingsToggle.setAttribute("aria-expanded", String(open));
            if (open) syncSettingsUI();
        });

        modeRadios().forEach(radio => {
            radio.addEventListener("change", () => {
                Settings.update({ mode: radio.value });
                smartFields.hidden = radio.value !== "smart";
                settingsHint.textContent = settingsStatus();
            });
        });

        keyInput.addEventListener("input", () => {
            Settings.update({ apiKey: keyInput.value.trim() });
            settingsHint.textContent = settingsStatus();
        });

        modelInput.addEventListener("input", () => {
            Settings.update({ model: modelInput.value.trim() });
            settingsHint.textContent = settingsStatus();
        });
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

        bindSettings();
        syncSettingsUI();
    }

    return { init };
})();

document.addEventListener("DOMContentLoaded", ChatUI.init);
