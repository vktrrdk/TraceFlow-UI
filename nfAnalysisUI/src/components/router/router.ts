import {createRouter, createWebHistory} from "vue-router";
import WorkflowComponent from "@/components/workflowComponent.vue";
import App from "@/App.vue"
import TokenComponent from "@/components/tokenComponent.vue";
import userComponent from "@/components/userComponent.vue";
import MainComponent from "@/components/mainComponent.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [{
            path: "/run/:token",
            name: "runs",
            component: WorkflowComponent,
            props: (route) => ({
                token: route.params.token,
            })
        },
        {
            path: "/",
            name : "main",
            component: MainComponent,
        },
        {
            path: "/token/:token_id?",
            name: "token",
            component: TokenComponent,
            props: (route) => ({
                token_id: route.params.token_id
            })
        },
        {
            path: "/user/:token?",
            name: "user",
            component: userComponent,
            props: (route) => ({
                token: route.params.token,
            })
        }

    ]
})

export default router;
