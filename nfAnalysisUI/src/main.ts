import './assets/main.css'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'

import { createApp } from 'vue'
import App from './App.vue'
//import UserComponent from "./components/userComponent/userComponent.vue";
//import router from router;

/* check out router and components in vue

const routes = [
    { path: '/', component: UserComponent },
    { path: '/user', component: UserComponent,}
]


const router = VueRouter.createRouter({

    history: VueRouter.
}) */

const app= createApp(App);
app.mount("#app");




