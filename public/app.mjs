// -------------------- i18n --------------------
const lang = (navigator.language || "en").toLowerCase().startsWith("no") ? "no" : "en";
document.documentElement.lang = lang;

const texts = {
  no: {
    title: "Klient",
    createUser: "Opprett bruker",
    deleteUser: "Slett bruker",
    editUser: "Rediger bruker",
    username: "brukernavn",
    password: "passord",
    tosVersion: "tosVersion (f.eks v2)",
    acceptTos: "Jeg godtar vilkår",
    create: "Opprett",
    delete: "Slett",
    update: "Oppdater",
    created: (u) => `Opprettet: ${u}`,
    deleted: (u) => `Slettet: ${u}`,
    updated: (u, v) => `Oppdatert: ${u} (${v})`,
    offline: "Du er offline",
  },
  en: {
    title: "Client",
    createUser: "Create user",
    deleteUser: "Delete user",
    editUser: "Edit user",
    username: "username",
    password: "password",
    tosVersion: "tosVersion (e.g. v2)",
    acceptTos: "I accept ToS",
    create: "Create",
    delete: "Delete",
    update: "Update",
    created: (u) => `Created: ${u}`,
    deleted: (u) => `Deleted: ${u}`,
    updated: (u, v) => `Updated: ${u} (${v})`,
    offline: "You are offline",
  },
};

function t(key, ...args) {
  const value = texts[lang][key];
  return typeof value === "function" ? value(...args) : value;
}

// -------------------- Service Worker register --------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}

// -------------------- fetch-funksjon + send språk til server --------------------
async function apiRequest(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      "accept-language": navigator.language || "en",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return { ok: true };

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// -------------------- LOGIC --------------------
function createUser({ username, password, accptTOS }) {
  return apiRequest("/api/users", {
    method: "POST",
    body: { username, password, accptTOS, tosVersion: "v1" },
  });
}

function deleteUser({ username, password }) {
  return apiRequest("/api/users", {
    method: "DELETE",
    body: { username, password },
  });
}

function editUser({ username, password, tosVersion }) {
  return apiRequest("/api/users", {
    method: "PATCH",
    body: { username, password, tosVersion },
  });
}

// -------------------- UI (custom web component) --------------------
class UserManager extends HTMLElement {
  connectedCallback() {
    this.render();
    this.wire();
  }

  render() {
    this.innerHTML = `
      <h1>${t("title")}</h1>

      <section>
        <h2>${t("createUser")}</h2>
        <input id="c-u" placeholder="${t("username")}" />
        <input id="c-p" placeholder="${t("password")}" type="password" />
        <label><input id="c-tos" type="checkbox" /> ${t("acceptTos")}</label>
        <button id="c-btn">${t("create")}</button>
      </section>

      <section>
        <h2>${t("deleteUser")}</h2>
        <input id="d-u" placeholder="${t("username")}" />
        <input id="d-p" placeholder="${t("password")}" type="password" />
        <button id="d-btn">${t("delete")}</button>
      </section>

      <section>
        <h2>${t("editUser")}</h2>
        <input id="e-u" placeholder="${t("username")}" />
        <input id="e-p" placeholder="${t("password")}" type="password" />
        <input id="e-v" placeholder="${t("tosVersion")}" />
        <button id="e-btn">${t("update")}</button>
      </section>

      <p id="msg" aria-live="polite"></p>
    `;
  }

  wire() {
    const msg = this.querySelector("#msg");
    const show = (text, isError = false) => {
      msg.textContent = text;
      msg.style.color = isError ? "crimson" : "green";
    };

    this.querySelector("#c-btn").addEventListener("click", async () => {
      try {
        const username = this.querySelector("#c-u").value.trim();
        const password = this.querySelector("#c-p").value;
        const accptTOS = this.querySelector("#c-tos").checked;

        const res = await createUser({ username, password, accptTOS });
        show(t("created", res.user.username));
      } catch (e) {
        show(e.message, true);
      }
    });

    this.querySelector("#d-btn").addEventListener("click", async () => {
      try {
        const username = this.querySelector("#d-u").value.trim();
        const password = this.querySelector("#d-p").value;

        await deleteUser({ username, password });
        show(t("deleted", username));
      } catch (e) {
        show(e.message, true);
      }
    });

    this.querySelector("#e-btn").addEventListener("click", async () => {
      try {
        const username = this.querySelector("#e-u").value.trim();
        const password = this.querySelector("#e-p").value;
        const tosVersion = this.querySelector("#e-v").value.trim();

        const res = await editUser({ username, password, tosVersion });
        show(t("updated", res.user.username, res.user.tosVersion));
      } catch (e) {
        show(e.message, true);
      }
    });

    window.addEventListener("offline", () => show(t("offline"), true));
  }
}

customElements.define("user-manager", UserManager);
document.querySelector("#app").innerHTML = `<user-manager></user-manager>`;