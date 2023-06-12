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

const workflowState = reactive<{
    loading: boolean;
    token: string;
    runTraces: RunTrace[];
}>({
    loading: true,
    token: "",
    runTraces: [],
});

watch(
    () => props.token, (newToken, oldToken) => {
        if (newToken !== oldToken) {
            updateToken(newToken);
        }
});

function updateToken(token) {
    workflowState.token = token;
    getData();
}
function getData() {
    workflowState.loading = true;
    axios.get(`http://localhost:8000/run/information/${props.token}/`).then(
        response => {
            console.log(response);
        },

    );
}

onMounted(() => {
    getData()
});
</script>

<template>
  <div class="alert alert-danger">
      hallo welt! {{props.token}}
  </div>

</template>

<style scoped>

</style>
