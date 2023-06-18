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


const currentState = reactive<{

}>({
});




function getData(userToken: string) {
        axios.get(`http://localhost:8000/user/token/${userToken}`).then(
            response => {
                console.log(response);
                if (response.data == null) {
                    this.faultyResponse = true;
                }
                else {
                    let data = response.data;
                    this.user.name = data.name;
                    this.user.run_tokens = data.run_tokens;
                    this.token = data.id;
                    this.faultyResponse = false;
                }
            }
        )
        this.token = userToken;
        this.user.name = "TestName";
        this.user.run_tokens = ["a4adas1", "6fjas4a"]
    }
    function getAllTraceData() {
        // we would like to have this for each token instead for one single token
        axios.get("http://localhost:8000/test/trace/all/").then(
            response => {
                console.log(response);
            }
        )
    }
    function getRunData(token: string) {
        axios.get(`http://localhost:8000/run/${token}/`).then(
            response => {
                console.log(response);
            })
    }
    function generateNewToken() {
        axios.get("http://localhost:8000/token/create").then(
            response => {
                console.log(response);
            }
        )
    }

    function removeToken(token_id: string) {
        axios.delete(`http://localhost:8000/token/remove/${token_id}/`).then(
            response => {
                console.log(response)
            }
        )
    }


onMounted(() => {
    //
});
</script>

<template>
    <div class="container">
        <div class="text-center p-4">
            <h4>Nextflow analysis tool</h4>
        </div>
        <div class="row row-cols-auto row-cols-md-2 g-4">
            <div class="col-md">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Manage User</h5>
                        <p class="card-text">You are able to create a new user or add tokens to a specific user.</p>
                        <router-link to="/user/">
                            <button type="button" class="btn btn-outline-dark">Go to user management</button>
                        </router-link>
                    </div>
                </div>
            </div>
            <div class="col-md">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Manage Tokens</h5>
                        <p class="card-text">Create new tokens to connect workflow runs with those tokens or check the status of certain tokens.</p>
                        <router-link to="/token/">
                            <button type="button" class="btn btn-outline-dark">Go to token management</button>
                        </router-link>
                    </div>
                </div>
            </div>
            <div class="col-md">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Workflows</h5>
                        <p class="card-text">For tokens with running workflows show data and plots.</p>
                        <router-link to="/run/">
                            <button type="button" class="btn btn-outline-dark">Show workflow state</button>
                        </router-link>
                    </div>
                </div>
            </div>
            <div class="col-md">
                <div class="card h-100">
                    <div class="card-body">
                        <h5 class="card-title">Help</h5>
                        <p class="card-text">Read the documentation if anything is unclear.</p>
                        <router-link to="/help/">
                            <button type="button" class="btn btn-outline-dark">Read the documentation</button>
                        </router-link>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>

</style>
