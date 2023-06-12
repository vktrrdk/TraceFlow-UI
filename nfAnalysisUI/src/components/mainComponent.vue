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
        axios.get(`http://localhost:8000/run/information/${token}/`).then(
            response => {
                console.log(response);
            })
    }
    function generateNewToken() {
        axios.get("http://localhost:8000/create/token/").then(
            response => {
                console.log(response);
            }
        )
    }

    function removeToken(token_id: string) {
        axios.get(`http://localhost:8000/remove/token/${token_id}/`).then(
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
    <div class="alert-info">
        Hello world!
    </div>
</template>

<style scoped>

</style>
