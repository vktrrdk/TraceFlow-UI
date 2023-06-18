<script setup lang="ts">
import {onMounted, reactive, watch} from "vue";
import "bootstrap"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap/dist/js/bootstrap.min.js"
import type { RunTrace } from "@/models/RunTrace";
import {useRouter, useRoute} from "vue-router";
import axios from "axios";

const router = useRouter();
const route = useRoute();

const props = defineProps<{
    token: string;
}>();

const userComponentState = reactive<{
    loading: boolean;
    token: string;
    user_name: string;
    new_user_name: string;
    run_tokens: string[];
    user_create_mode: boolean;
    existing_user_mode: boolean;
    show_existing_user_information: boolean;
    token_to_add: string;
    error_on_user_load: boolean;
    newly_created_user: any;
    user_creation_requested: boolean;
}>({
    loading: true,
    token: "",
    user_name: "",
    new_user_name: "",
    run_tokens: [],
    user_create_mode: false,
    existing_user_mode: false,
    show_existing_user_information: false,
    token_to_add: "",
    error_on_user_load: false,
    newly_created_user: {},
    user_creation_requested: false,
});

watch(
    () => props.token, (newToken, oldToken) => {
        if (newToken !== oldToken) {
            updateToken(newToken);
        }
    });

function updateToken(token) {
    userComponentState.token = token;
    getData();
}
function getData(token = props.token) {
    userComponentState.loading = true;
    if (token?.length > 0) {
        axios.get(`http://localhost:8000/user/${token}/`).then(
            response => {
                let data = response.data;
                if (data["id"] && data["id"].length > 0) {
                    userComponentState.loading = false;
                    userComponentState.token = data["id"];
                    userComponentState.user_name = data["name"];
                    userComponentState.run_tokens = data["run_tokens"];
                    userComponentState.show_existing_user_information = true;
                    userComponentState.error_on_user_load = false;
                    userComponentState.user_creation_requested = false;
                } else {
                    userComponentState.error_on_user_load = true;

                }
            },
        );
    } else {
        userComponentState.user_create_mode = false;
        userComponentState.existing_user_mode = false;

    }

}

function generateNewUserSpecificToken(user_token: string) {
    axios.get(`http://localhost:8000/user/${user_token}/token/create/`).then(
        () => {
            getData(userComponentState.token);
        }
    )
}

function addTokenToUser(user_token: string, token_to_add: string) {
    axios.post(`http://localhost:8000/user/token/add/`,  {
        token: token_to_add,
        user_token: user_token,
    }).then(
        response => {
            console.log(response.data);
            getData(userComponentState.token);
        }
    )
}

function createNewUser(user_name: string) {
    userComponentState.loading = true;
    axios.post(`http://localhost:8000/user/create/`,
        {name: user_name}).then(
        response => {
            userComponentState.newly_created_user = response.data;
            userComponentState.user_creation_requested = true;
            userComponentState.loading = false;
            userComponentState.user_create_mode = false;
        }
    )
}

function setEnterTokenMode() {
    userComponentState.existing_user_mode = true;
    userComponentState.user_create_mode = false;
}

function setEnterNewUserMode() {
    userComponentState.existing_user_mode = false;
    userComponentState.user_create_mode = true;
}

function removeTokenFromUser(token_to_remove: string) {
    axios.delete(`http://localhost:8000/user/${userComponentState.token}}/token/${token_to_remove}`).then(
        response => {
            console.log(response);
            getData(userComponentState.token);
        },
        error => {
            console.log(error);
        }
    )
}

function getLink(token: string){
    return `/run/${token}/`;
}

function getUserLink(token: string) {
    return `/user/${token}/`;
}

/*
    TODO:
    - pro modus nur die relevanten informationen anzeigen
    - request handling anpassen --> error-handling
    - state-variablen anpassen
 */

onMounted(() => {
    getData()
});
</script>

<template>
    <div class="card">
        <h5 class="card-header">User Management</h5>
        <div class="card-body" v-if="props.token?.length == 0 || !props.token">
            <div class="btn-group">
                <button :class="{'btn-outline-primary' : !userComponentState.existing_user_mode, 'btn-primary': userComponentState.existing_user_mode}"
                        class="btn " @click="setEnterTokenMode()">Enter existing token</button>
                <button :class="{'btn-outline-primary' : !userComponentState.user_create_mode, 'btn-primary': userComponentState.user_create_mode}"
                    class="btn" @click="setEnterNewUserMode()">Create new User</button>
            </div>
        </div>
        <div class="card-body" v-if="userComponentState.existing_user_mode">
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Token</span>
                <input v-model="userComponentState.token" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
                <button @click="getData(userComponentState.token)" class="btn btn-outline-primary" type="button">Show</button>
            </div>
        </div>
        <div class="card-body" v-if="userComponentState.show_existing_user_information && !userComponentState.loading && !userComponentState.error_on_user_load">
            <h6 class="card-title">
                {{userComponentState.user_name}} - {{userComponentState.token}}
            </h6>
            <table class="table" v-if="userComponentState.run_tokens?.length > 0">
                <thead>
                    <tr>
                        <th scope="col">#</th>
                        <th scope="col">Token</th>
                        <th scope="col">Actions</th>
                    </tr>
                </thead>
                <tbody>
                <!-- ESLint: Elements in iteration expect to have 'v-bind:key' directives.(vue/require-v-for-key) ??-->
                    <tr v-for="(token, index) in userComponentState.run_tokens">
                        <td scope="row">{{index + 1}}</td>
                        <td>{{token}}</td>
                        <td>
                            <div class="btn-group">
                                <button @click="router.push(getLink(token))" type="button" class="btn btn-outline-dark">Show Run information</button>
                                <button @click="removeTokenFromUser(token)" type="button" class="btn btn-outline-danger">Remove</button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="alert alert-dark" v-else>
                There are no tokens saved for this user so far - add new tokens below!
            </div>
            <label for="add_existing_token_input">Add existing token</label>
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Token</span>
                <input v-model="userComponentState.token_to_add" type="text" class="form-control" placeholder="Token" aria-label="Username" id="add_existing_token_input" aria-describedby="basic-addon1">
                <button @click="addTokenToUser(userComponentState.token, userComponentState.token_to_add)" class="btn btn-outline-dark" type="button">Add</button>
            </div>

            <button type="button" @click="generateNewUserSpecificToken(userComponentState.token)" class="btn btn-outline-dark">Create new token</button>
        </div>
        <div class="card-body" v-if="userComponentState.error_on_user_load">
            <div class="alert alert-danger">
                There is no user with the entered token!
            </div>
        </div>
        <div class="card-body" v-if="userComponentState.user_create_mode">
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Username</span>
                <input v-model="userComponentState.new_user_name" type="text" class="form-control" placeholder="Username" aria-label="Username" aria-describedby="basic-addon1">
                <button @click="createNewUser(userComponentState.new_user_name)" class="btn btn-outline-dark" type="button">Create</button>
            </div>
        </div>
        <div class="card-body" v-if="!userComponentState.loading
            && userComponentState.user_creation_requested
            && userComponentState.newly_created_user['id']">
            <div class="alert alert-dark">
                New user with name {{userComponentState.newly_created_user.name}} created. <br>
                <strong>User token ID: {{userComponentState.newly_created_user.id}}</strong>
                <hr>
                <button type="button" class="btn btn-outline-dark"
                        @click="getData(userComponentState.newly_created_user.id)">Manage</button>
            </div>
        </div>

    </div>

</template>

<style scoped>

</style>
