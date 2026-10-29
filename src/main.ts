import { createApp } from "vue";
import App from "@/App.vue";
import "@/styles/main.scss";

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  console.error("[Vue Error]:", err, info);
};

window.addEventListener("error", (event) => {
  console.error("[Window Error]:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Rejection]:", event.reason);
});

app.mount("#app");
