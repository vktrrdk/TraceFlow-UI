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
    axios.get("http://localhost:8000/token/create/").then(
        response => {
            currentState.newly_created_token = response.data["token"]["id"];
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
    axios.get(`http://localhost:8000/token/validate/${token_id}/`).then(
        response => {
            currentState.loading = false;
            currentState.token_exists = response.data["valid"];
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
            Enter a run-token to get all information on a token, or generate a new token.
        </h6>
        <div class="input-group mb-3">
            <span class="input-group-text" id="basic-addon1">Token</span>
            <input v-model="currentState.token" type="text" class="form-control" placeholder="token" aria-label="Username" aria-describedby="basic-addon1">
            <button @click="showTokenInformation(currentState.token)" class="btn btn-outline-primary" type="button">Show</button>
        </div>

        <hr>
        <button class="btn btn-outline-primary" @click="generateNewToken()">
            Generate new token
        </button>
        <div class="card-body" v-if="currentState.token_generation_requested">
            <div class="alert alert-info">
                Your newly created token is: <strong>{{currentState.newly_created_token}}</strong>.
                Please persist this token. You can now register workflows to this token.
                <router-link :to="getLink(currentState.newly_created_token)">
                    <button class="btn btn-outline-info">Show information</button>
                </router-link>
            </div>
        </div>
        <div v-if="currentState.token_information_requested">
        <div class="card-body" v-if="currentState.token_exists">
            <div class="alert alert-info">
                The token <strong>{{currentState.token}}</strong> is valid. You can either register a run to this token or check the persisted run-data for this token here:
                <router-link :to="getLink(currentState.token)">
                    <button class="btn btn-outline-dark">Show information</button>
                </router-link>
            </div>
        </div>
        <div class="card-body" v-if="!currentState.token_exists && currentState.token_information_requested">
            <div class="alert alert-info">
                <strong>The entered token is not correct.</strong>
                There is no such token persisted in the database. Please check the entered token and correct your submitted entry or generate a new token.
            </div>
        </div>
        </div>
    </div>

</div>
</template>

<style scoped>

</style>
