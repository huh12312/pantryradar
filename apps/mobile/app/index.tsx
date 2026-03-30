import { Redirect } from "expo-router";

export default function Index() {
  // TODO: Check auth status and redirect to login or tabs
  return <Redirect href="/login" />;
}
