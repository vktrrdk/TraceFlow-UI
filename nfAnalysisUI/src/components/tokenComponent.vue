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
    token_id: string;
}>();

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const currentState = reactive<{
    loading: boolean;
    token: string;
    newly_created_token: string;
    faultyResponse: boolean;
    token_exists: boolean;
    token_information_requested: boolean;
    token_generation_requested: boolean;
}>({
    loading: false,
    token: "",
    newly_created_token: "",
    faultyResponse: false,
    token_exists: false,
    token_information_requested: false,
    token_generation_requested: false,
});


function generateNewToken() {
    currentState.loading = true;
    currentState.token_information_requested = false;
    console.log(API_BASE_URL)
    axios.get(`${API_BASE_URL}token/create/`).then(
        response => {
            currentState.newly_created_token = response.data["id"];
            currentState.loading = false;
            currentState.token_generation_requested = true;
        }
    )
}

function showTokenInformation(token_id: string) {
    currentState.loading = true;
    currentState.token_information_requested = true;
    currentState.token_generation_requested = false;
    currentState.token = token_id;
    axios.get(`${API_BASE_URL}token/validate/${token_id}/`).then(
        response => {
            currentState.loading = false;
            if (response.data["valid"] == true) {
                router.push(getLink(token_id));
            } else {
                currentState.token_exists = false;
            }


        }
    )
}

function getLink(token: string){
  return `/run/${token}/`;
}

onMounted(() => {
    if (props.token_id && props?.token_id.length > 0) {
        showTokenInformation(props.token_id);
    }
});
</script>

<template>

<div class="card">
    <h5 class="card-header">Token</h5>
        <div class="card-body">
            <h6 class="card-subtitle mb-2">
                Enter a run-token to get information on a token, or generate a new token.
            </h6>
            <div class="input-group mb-3">
                <span class="input-group-text" id="basic-addon1">Token</span>
                <input v-model="currentState.token" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
                <button @click="showTokenInformation(currentState.token)" class="btn btn-outline-primary" type="button">Show</button>
            </div>
        </div>

        <div class="card-body" v-if="currentState.token_generation_requested && currentState.newly_created_token?.length >=0">
            <div class="alert alert-dark">
                Your newly created token is: <strong>{{currentState.newly_created_token}}</strong>.
                Please persist this token. You can now register workflows to this token.
                <hr>
                <button class="btn btn-outline-dark" @click="router.push(getLink(currentState.newly_created_token))">
                    Show Information
                </button>
            </div>
        </div>
        <div v-if="currentState.token_information_requested">
        <div class="card-body" v-if="!currentState.token_exists && currentState.token_information_requested">
            <div class="alert alert-info">
                <strong>The entered token is not correct.</strong>
                There is no such token persisted in the database. Please check the entered token and correct your submitted entry or generate a new token.
            </div>
        </div>
        </div>
        <hr>
        <div class="card-body">
            <button class="btn btn-outline-primary" @click="generateNewToken()">
                Generate new token
            </button>
        </div>
</div>

</template>

<style scoped>

</style>
