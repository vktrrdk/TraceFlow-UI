import './assets/main.css'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap-grid.min.css'
import 'bootstrap/dist/js/bootstrap.min.js'

import { createApp } from 'vue'
import App from './App.vue'
//import UserComponent from "./components/userComponent/userComponent.vue";
import router from "./components/router/router";

import PrimeVue from 'primevue/config';
import 'primevue/resources/themes/lara-light-teal/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';  
import ConfirmationService from 'primevue/confirmationservice';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip'

/* check out router and components in vue

const routes = [
    { path: '/', component: UserComponent },
    { path: '/user', component: UserComponent,}
]


const router = VueRouter.createRouter({

    history: VueRouter.
}) */

const app = createApp(App).use(PrimeVue).directive('tooltip', Tooltip).use(router).use(ConfirmationService).use(ToastService).mount("#app");







