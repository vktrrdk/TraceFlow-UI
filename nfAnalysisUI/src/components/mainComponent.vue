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
        
        </div>
    </div>
</template>

<style scoped>

</style>
