
console.log("client loaded");

document.querySelector("#app").innerHTML = `
<h1>Client</h1>
<p> Hvis du ser dette, blir public-filer servert riktig.</p>
`;

//--------------------------en fetch funksjon)-------------------//

async function apiRequest(path, { method = "GET", body } = {}) {
 const res = await fetch(path,  {
        method,
        headers: body ? { "content-Type": "application/JSON" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    });

                // 204 No Content//
if (res.status === 204) return {ok: true };

const text = await res.text();
let data = {};
try { data = text ? JSON.parse(text) : {}; } catch{ data = {raw: text}; }

//----------------------------------------------------------------------//


if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

// -------------------- LOGIC (bruker kun apiRequest) --------------------
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
      <h1>Client</h1>

      <section>
        <h2>Create user</h2>
        <input id="c-u" placeholder="username" />
        <input id="c-p" placeholder="password" type="password" />
        <label><input id="c-tos" type="checkbox" /> I accept ToS</label>
        <button id="c-btn">Create</button>
      </section>

      <section>
        <h2>Delete user</h2>
        <input id="d-u" placeholder="username" />
        <input id="d-p" placeholder="password" type="password" />
        <button id="d-btn">Delete</button>
      </section>

      <section>
        <h2>Edit user</h2>
        <input id="e-u" placeholder="username" />
        <input id="e-p" placeholder="password" type="password" />
        <input id="e-v" placeholder="tosVersion (f.eks v2)" />
        <button id="e-btn">Update</button>
      </section>

      <p id="msg"></p>
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
        show(`Created: ${res.user.username}`);
      } catch (e) {
        show(e.message, true);
      }
    });

    this.querySelector("#d-btn").addEventListener("click", async () => {
      try {
        const username = this.querySelector("#d-u").value.trim();
        const password = this.querySelector("#d-p").value;
        await deleteUser({ username, password });
        show(`Deleted: ${username}`);
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
        show(`Updated: ${res.user.username} (${res.user.tosVersion})`);
      } catch (e) {
        show(e.message, true);
      }
    });
  }
}

customElements.define("user-manager", UserManager);

// mount
document.querySelector("#app").innerHTML = `<user-manager></user-manager>`;