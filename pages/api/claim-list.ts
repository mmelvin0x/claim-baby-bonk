import axios from "axios";
import { NextApiRequest, NextApiResponse } from "next";
import * as qs from "qs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const URL = process.env.CMS_URL!;

  try {
    switch (req.method) {
      case "GET":
        const query = qs.stringify({
          filters: { address: req.query.address },
        });
        const { data: claimList } = await axios.get(
          `${URL}/api/token-claims?${query}`
        );
        return res.json({
          addresses: claimList.data.map((it: any) => it.attributes.address),
        });

      case "POST":
        const { address } = req.body;
        await axios.post(`${URL}/api/token-claims`, { data: { address } });
        return res.json({ success: true });
    }
  } catch (e: any) {
    console.error(e.response?.data?.error);
    return res.json({ error: "Internal Server Error" });
  }
}
