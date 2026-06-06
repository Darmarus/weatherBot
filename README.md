# 🌦️ Weather Assistant — asystent pogodowy

Chatbot, który na podstawie pogody doradza, **jak się ubrać**. Opisz warunki
zwykłym językiem (np. *„Jest 7 stopni i pada deszcz”*) albo wpisz samą nazwę
miasta — a asystent dobierze odpowiedni strój i doda poradę stylistyczną.

Aplikacja w czystym **Vanilla JS** (bez frameworków), z integracją **OpenWeather API**.

🔗 **Demo na żywo:** https://darmarus.github.io/weatherBot/

---

## ✨ Funkcje

- 💬 **Czat** — rekomendacja ubioru na podstawie temperatury i warunków pogodowych
- 🏙️ **Pogoda dla miasta** — wpisz nazwę miasta w czacie lub użyj panelu 📍 (dane z OpenWeather)
- 🧠 **Analiza języka polskiego** — rozpoznaje temperaturę i warunki (deszcz, śnieg, wiatr, słońce, mgła, burza, mróz, upał) z tekstu
- 🌗 **Tryb jasny / ciemny** — z zapamiętaniem wyboru i wykrywaniem preferencji systemu
- 💾 **Historia rozmowy** — zapisywana w `localStorage`
- ⌨️ **Wskaźnik pisania**, animacje, auto-scroll
- ♿ **Dostępność** — ARIA, `aria-live`, etykiety dla czytników ekranu
- 📱 **Responsywność** — działa na telefonie i desktopie
- 🛡️ **Fallback demo** — gdy brak klucza API, brak sieci lub klucz nieaktywny, bot używa danych demonstracyjnych zamiast pokazywać błąd

---

## 🗂️ Struktura projektu

| Plik | Opis |
|------|------|
| `index.html` | Struktura interfejsu czatu |
| `style.css` | Style — zmienne motywu, light/dark, animacje, responsywność |
| `script.js` | Logika aplikacji w 3 modułach (patrz niżej) |
| `assets/` | Ikony SVG (avatar bota, favicon) |
| `Web.config` | Konfiguracja IIS Express (uruchamianie z Visual Studio) |

### Architektura `script.js`

Kod podzielony jest na trzy niezależne moduły (wzorzec IIFE):

1. **`WeatherBrain`** — czysta logika rekomendacji (bez DOM): parsowanie temperatury,
   wykrywanie warunków, klasyfikacja i budowa porady. Łatwa do testowania.
2. **`WeatherAPI`** — integracja z OpenWeather (Fetch API) z trybem demo jako fallback.
3. **`ChatUI`** — warstwa interfejsu: wiadomości, historia, dark mode, obsługa zdarzeń.

---

## 🚀 Uruchomienie lokalne

Aplikacja jest w pełni statyczna — wystarczy serwer plików (a najlepiej **nie**
otwierać przez `file://`, bo przeglądarka zablokuje wtedy zapytania do API).

```bash
# Dowolny z poniższych:
npx serve .            # Node.js
python -m http.server  # Python 3
```

Następnie otwórz `http://localhost:8000` (lub port wskazany przez narzędzie).

W Visual Studio wystarczy otworzyć rozwiązanie `weatherBot.sln` i nacisnąć **F5**.

---

## 🔑 Klucz OpenWeather API

Bez klucza aplikacja działa w **trybie demonstracyjnym** (losowe, realistyczne dane).
Aby pobierać prawdziwą pogodę:

1. Załóż darmowe konto na [openweathermap.org](https://openweathermap.org/api)
   i wygeneruj klucz w panelu [API keys](https://home.openweathermap.org/api_keys).
2. Wklej go w `script.js` (moduł `WeatherAPI`):

   ```js
   const API_KEY = "twoj_klucz_tutaj";
   ```

> ⏳ Nowy klucz aktywuje się do ok. **2 godzin** — do tego czasu zwraca błąd 401,
> a aplikacja automatycznie korzysta z danych demo.

> ⚠️ **Uwaga:** w aplikacji front-endowej klucz jest widoczny dla każdego, kto
> otworzy źródło strony. Dla projektu demonstracyjnego to akceptowalne; w wersji
> produkcyjnej klucz należy ukryć za własnym proxy backendowym.

---

## 🌍 Wdrożenie (deploy)

Jako strona statyczna nadaje się na dowolny hosting plików:
- **GitHub Pages** — Settings → Pages → branch `master`, folder `/ (root)`


---

## 🛠️ Technologie

HTML5 · CSS3 (zmienne, flexbox, animacje) · JavaScript (ES6+, Fetch API, modularny IIFE) · OpenWeather API

---

## 📄 Licencja

Projekt edukacyjny — do dowolnego użytku.
