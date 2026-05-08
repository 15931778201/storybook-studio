import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import "./style.css";
import TresPlugin from '@tresjs/core'

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(TresPlugin);
app.mount("#app");
