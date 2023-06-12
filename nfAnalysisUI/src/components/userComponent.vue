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
}>({
    loading: true,
    token: "",
    user_name: "",
    new_user_name: "",
    run_tokens: [],
    user_create_mode: false,
    existing_user_mode: false,
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
    if (token?.length > 0) {
        axios.get(`http://localhost:8000/user/token/${props.token}/`).then(
            response => {
                console.log(response);
            },

        );
    } else {
        userComponentState.user_create_mode = false;
        userComponentState.existing_user_mode = false;
    }

}

function generateNewUserSpecificToken(user_token: string) {
    axios.get(`http://localhost:8000/create/token/user/${user_token}/`).then(
        response => {
            console.log(response);
        }
    )
}
function createNewUser(user_name: string) {
    axios.get(`http://localhost:8000/user/create/${user_name}/`).then(
        response => {
            console.log(response);
        }
    )
}

function setEnterTokenMode() {
    userComponentState.existing_user_mode = false;
    userComponentState.user_create_mode = true;
}

function setEnterNewUserMode() {
    userComponentState.existing_user_mode = true;
    userComponentState.user_create_mode = false;
}

onMounted(() => {
    getData()
});
</script>

<template>
    <div class="card">
        <h5 class="card-header">User Management</h5>
        <div class="card-body" v-if="props.token?.length == 0 || !props.token">
            <div class="btn-group">
                <button class="btn btn-outline-primary" @click="setEnterTokenMode()">Enter existing token</button>
                <button class="btn btn-outline-primary" @click="setEnterNewUserMode()">Create new User</button>
            </div>
        </div>
        <div class="card-body" v-if="userComponentState.existing_user_mode">
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Token</span>
                <input v-model="userComponentState.token" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
                <button @click="getData(userComponentState.token)" class="btn btn-outline-primary" type="button">Show</button>
            </div>
        </div>
        <div class="card-body" v-if="userComponentState.user_create_mode">
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Username</span>
                <input v-model="userComponentState.new_user_name" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
                <button @click="createNewUser(userComponentState.new_user_name)" class="btn btn-outline-primary" type="button">Create</button>
            </div>
        </div>
    </div>

</template>

<style scoped>

</style>
