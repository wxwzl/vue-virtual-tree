import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "@wxwzl/vue-virtual-scroller/style";

const app = createApp(App);
app.use(router);
app.mount("#app");
